import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERIODS, brokerChartData, buildPortfolioHistory, changeOver, latestTimestamp, periodStart, qtyAt } from '../src/lib/history.js';
import { brokerValues, computePortfolio, currencyExposure } from '../src/lib/portfolio.js';
import { getMarketHistory, parseHistory } from '../api/_lib/history.js';

const brokers = [{ id: 'b1', name: 'Broker1', currency: 'EUR' }, { id: 'b2', name: 'Broker2', currency: 'EUR' }];
const pos = (id, brokerId, symbol, qty, extra = {}) => ({ id, brokerId, name: symbol || id, symbol, type: 'Large Caps', qty, avgPrice: 1, ...extra });
const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);

test('valor en euros = cantidad × precio × tipo de cambio de cada fecha', () => {
  const series = { MSFT: { c: 'USD', t: [100, 200, 300], v: [400, 440, 500] } };
  const fx = { USDEUR: { t: [100, 200, 300], v: [0.9, 0.8, 0.85] } };
  const { points } = buildPortfolioHistory({ positions: [pos('1', 'b1', 'MSFT', 2)], brokers, series, fx, currency: 'EUR' });
  assert.deepEqual(points.map((p) => p.total), [720, 704, 850]);
  assert.equal(points[0].t, 100_000);
  // La bajada de febrero se debe al dólar, no al precio (440 > 400): el efecto divisa se puede quitar
  const cur = buildPortfolioHistory({ positions: [pos('1', 'b1', 'MSFT', 2)], brokers, series, fx, currentFx: { USDEUR: 0.85 }, fxMode: 'current', currency: 'EUR' });
  assert.deepEqual(cur.points.map((p) => p.total), [680, 748, 850]);
});

test('sin serie de tipo de cambio se usa el actual; sin ninguno, se avisa', () => {
  const series = { AAA: { c: 'USD', t: [1, 2], v: [10, 20] } };
  const withCur = buildPortfolioHistory({ positions: [pos('1', 'b1', 'AAA', 1)], brokers, series, currentFx: { USDEUR: 0.5 }, currency: 'EUR' });
  assert.deepEqual(withCur.points.map((p) => p.total), [5, 10]);
  const none = buildPortfolioHistory({ positions: [pos('1', 'b1', 'AAA', 1)], brokers, series, currency: 'EUR' });
  assert.equal(none.points.length, 0);
  assert.match(none.missing[0], /tipo de cambio USD/);
});

test('agrupa por broker, incluye posiciones manuales y suma las cuentas al total', () => {
  const series = {
    AAA: { c: 'EUR', t: [1, 2, 3], v: [10, 11, 12] },
    BBB: { c: 'EUR', t: [1, 3], v: [100, 130] }, // sin dato en t=2 → último valor conocido
  };
  const positions = [
    pos('1', 'b1', 'AAA', 10), pos('2', 'b2', 'BBB', 1),
    { id: '3', brokerId: 'b1', name: 'Efectivo', symbol: '', type: 'Efectivo', qty: null, avgPrice: 1100, manualValue: 1100 },
    pos('4', 'b2', 'SOLD', 0), // sin cantidad: no cuenta
  ];
  const h = buildPortfolioHistory({ positions, brokers, series, currency: 'EUR', cash: 500 });
  assert.deepEqual(h.points.map((p) => p.brokers.b1), [1200, 1210, 1220]);
  assert.deepEqual(h.points.map((p) => p.brokers.b2), [100, 100, 130]);
  assert.deepEqual(h.points.map((p) => p.assets), [1300, 1310, 1350]);
  assert.deepEqual(h.points.map((p) => p.total), [1800, 1810, 1850]);
  assert.deepEqual(h.brokerIds, ['b1', 'b2']);
  assert.deepEqual(h.missing, []);
});

test('efectivo en otra divisa varía con el tipo de cambio', () => {
  const series = { AAA: { c: 'EUR', t: [1, 2], v: [1, 1] } };
  const fx = { USDEUR: { t: [1, 2], v: [0.9, 0.8] } };
  const usd = [{ id: 'b3', name: 'USD', currency: 'USD' }];
  const positions = [pos('1', 'b3', 'AAA', 1), { id: '2', brokerId: 'b3', name: 'Cash USD', symbol: '', type: 'Efectivo', avgPrice: 1000, manualValue: 1000 }];
  const h = buildPortfolioHistory({ positions, brokers: usd, series, fx, currency: 'EUR' });
  assert.deepEqual(h.points.map((p) => p.assets), [901, 801]);
});

test('operaciones registradas ajustan la cantidad en el pasado', () => {
  const p = { qty: 5, trades: [{ date: '2026-03-10', side: 'buy', qty: 3, price: 10 }, { date: '2026-06-01', side: 'sell', qty: 1, price: 12 }] };
  const ts = (d) => Date.parse(`${d}T12:00:00Z`) / 1000;
  assert.equal(qtyAt(p, ts('2026-02-01')), 3); // 5 − 3 + 1
  assert.equal(qtyAt(p, ts('2026-03-10')), 6); // ya comprada
  assert.equal(qtyAt(p, ts('2026-07-01')), 5);
  assert.equal(qtyAt({ qty: 2 }, ts('2020-01-01')), 2); // sin operaciones: siempre la actual
});

test('ventana, límite de puntos y cambio del periodo', () => {
  const t = Array.from({ length: 1000 }, (_, i) => 1000 + i);
  const series = { AAA: { c: 'EUR', t, v: t.map((x) => x / 10) } };
  const full = buildPortfolioHistory({ positions: [pos('1', 'b1', 'AAA', 1)], brokers, series, currency: 'EUR', maxPoints: 100 });
  assert.equal(full.points.length, 100);
  assert.equal(full.points[0].t, 1_000_000);
  assert.equal(full.points[99].t, 1_999_000);
  const win = buildPortfolioHistory({ positions: [pos('1', 'b1', 'AAA', 1)], brokers, series, currency: 'EUR', from: 1_500_000 });
  assert.equal(win.points[0].t, 1_500_000);
  const ch = changeOver(win.points);
  close(ch.change, 49.9, 1e-9);
  close(ch.pct, 199.9 / 150 - 1, 1e-9); // de 150 a 199,9
  assert.equal(latestTimestamp(series), 1_999_000);
  assert.equal(periodStart('1d', 10 * 86_400_000, 5 * 86_400_000), 4 * 86_400_000);
  assert.equal(periodStart('5y'), 0);
  assert.equal(PERIODS.length, 6);
});

test('gráfico por broker en valor y en porcentaje', () => {
  const series = { AAA: { c: 'EUR', t: [1, 2], v: [10, 15] }, BBB: { c: 'EUR', t: [1, 2], v: [100, 90] } };
  const h = buildPortfolioHistory({ positions: [pos('1', 'b1', 'AAA', 10), pos('2', 'b2', 'BBB', 1)], brokers, series, currency: 'EUR' });
  assert.deepEqual(brokerChartData(h.points, h.brokerIds, 'value').map((r) => [r.b1, r.b2, r.total]), [[100, 100, 200], [150, 90, 240]]);
  const pct = brokerChartData(h.points, h.brokerIds, 'pct');
  assert.deepEqual([pct[1].b1, pct[1].b2, pct[1].total], [50, -10, 20]);
});

test('valor por broker y exposición por divisa de la cartera', () => {
  const positions = [
    pos('1', 'b1', 'MSFT', 2, { avgPrice: 400 }), pos('2', 'b1', 'CSU.TO', 1, { avgPrice: 1000 }),
    { id: '3', brokerId: 'b2', name: 'Efectivo', symbol: '', type: 'Efectivo', avgPrice: 500, manualValue: 500 },
  ];
  const ctx = { quotes: { MSFT: { price: 500, currency: 'USD' }, 'CSU.TO': { price: 2000, currency: 'CAD' } }, fx: { USDEUR: 0.9, CADEUR: 0.65 }, currency: 'EUR', brokers };
  const pf = computePortfolio(positions, ctx);
  assert.deepEqual(brokerValues(pf), { b1: 900 + 1300, b2: 500 });
  const exp = currencyExposure(pf, 'EUR', brokers);
  assert.deepEqual(exp.map((e) => e.currency), ['CAD', 'USD', 'EUR'].sort((a, b) => ({ CAD: 1300, USD: 900, EUR: 500 }[b] - { CAD: 1300, USD: 900, EUR: 500 }[a])));
  close(exp.reduce((s, e) => s + e.weight, 0), 1);
});

test('API: normaliza el histórico de Yahoo (nulos, peniques) y pide divisas', async () => {
  const chart = (meta, timestamp, close) => ({ chart: { result: [{ meta, timestamp, indicators: { quote: [{ close }] } }] } });
  const h = parseHistory(chart({ currency: 'GBp' }, [1, 2, 3, 4], [812, null, 0, 900]));
  assert.deepEqual(h, { c: 'GBP', t: [1, 4], v: [8.12, 9] });
  assert.equal(parseHistory({ chart: { result: null } }), null);
  const calls = [];
  const fake = async (url) => {
    calls.push(url);
    const sym = decodeURIComponent(url.split('/chart/')[1].split('?')[0]);
    const data = { MSFT: ['USD', [1, 2], [400, 410]], 'USDEUR=X': ['EUR', [1, 2], [0.9, 0.91]] }[sym];
    return data ? { ok: true, json: async () => chart({ currency: data[0] }, data[1], data[2]) } : { ok: false, status: 404 };
  };
  const r = await getMarketHistory(['MSFT', 'NOPE'], [], 'EUR', '1y', '1d', fake);
  assert.deepEqual(Object.keys(r.series), ['MSFT']);
  assert.deepEqual(r.fx.USDEUR.v, [0.9, 0.91]);
  assert.ok(calls.some((u) => u.includes('range=1y') && u.includes('interval=1d')));
});
