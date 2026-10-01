import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePortfolio, analyzePortfolio, applyTrade, fxRate } from '../src/lib/portfolio.js';
import { excelSeed } from '../src/lib/defaults.js';

// Precios y tipos de cambio guardados en el propio CARTERA.xlsx, para comprobar
// que la app reproduce exactamente los resultados de la hoja "Cartera".
const USDEUR = 0.8780402142418122;
const CADEUR = 0.622975330176925;
const TWDEUR = 0.027628736095838557;
const quotes = {
  MSFT: { price: 498.895, currency: 'USD', high52: 553.72, low52: 349.2 },
  META: { price: 759.32, currency: 'USD' },
  'CSU.TO': { price: 2742, currency: 'CAD' },
  AMZN: { price: 249.492, currency: 'USD' },
  NVDA: { price: 224.625, currency: 'USD' },
  GOOGL: { price: 339.32, currency: 'USD' },
  '2330.TW': { price: 2500, currency: 'TWD' },
  V: { price: 362.96, currency: 'USD' },
  'BTC-EUR': { price: 1221 / 0.016213, currency: 'EUR' },
};
const fx = { USDEUR, CADEUR, TWDEUR };

function excelPortfolio() {
  const seed = excelSeed();
  return computePortfolio(seed.positions, { quotes, fx, currency: 'EUR', brokers: seed.brokers, targetAmount: 8000 });
}

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('reproduce la hoja Cartera del Excel', () => {
  const pf = excelPortfolio();
  const by = Object.fromEntries(pf.assets.map((a) => [a.name, a]));
  // Valores copiados de las columnas D, E, G, H, J, K de la hoja Cartera
  close(by.Microsoft.invested, 1095.7671007112126);
  close(by.Microsoft.value, 1215.719811660374);
  close(by.Microsoft.returnPct, 0.10946916627749226);
  close(by.Microsoft.weight, 0.1829366167091822);
  close(by.Microsoft.rebalance, -301.9526440460239);
  assert.equal(by.Microsoft.rebalanceTarget, -116);
  close(by['Constellation Software'].value, 660.0478445053576);
  assert.equal(by['Constellation Software'].rebalanceTarget, 140);
  close(by.Efectivo.value, 1100);
  close(by.Efectivo.weight, 0.16552356591546322);
  assert.equal(by.Efectivo.rebalanceTarget, -300);
  close(by.Bitcoin.invested, 1313.0 + 0.253, 1e-2); // 0,016213 × 81.000
  assert.equal(by['Taiwan Semiconductor'].value, 0);
  assert.equal(by.Visa.rebalanceTarget, 400);
  close(pf.targetWeightSum, 1);
  close(pf.weightSum, 1);
});

test('retorno anual esperado a 5 años (hoja Seguimiento)', () => {
  const pf = excelPortfolio();
  const msft = pf.assets.find((a) => a.symbol === 'MSFT');
  close(msft.expectedCagr, 0.13118220366552658);
  close(msft.range52, 0.7319333072560139);
});

test('análisis de cartera', () => {
  const pf = excelPortfolio();
  const an = analyzePortfolio(pf, {}, { price: 6500, high52: 6800 });
  const get = (id) => an.checks.find((c) => c.id === id);
  // 6 empresas con peso > 0 (TSMC y Visa están a 0) → demasiado concentrada
  assert.equal(an.companies, 6);
  assert.match(get('companies').text, /demasiado concentrada/);
  // Principal posición: Bitcoin (18,4%), que no es pilar
  assert.match(get('top').text, /Bitcoin/);
  assert.equal(get('top').status, 'warning');
  // Pilares = 18,3+15,0+9,9+9,9+6,0 = 59% < 70%
  assert.equal(get('pilares').status, 'warning');
  assert.ok(an.losers.some((l) => l.name === 'Constellation Software' && l.alert));
  close(an.market.drawdown, (6500 - 6800) / 6800);
  assert.ok(an.beta > 0);
});

test('conversión de divisas directa e inversa', () => {
  assert.equal(fxRate({}, 'EUR', 'EUR'), 1);
  assert.equal(fxRate({ USDEUR: 0.9 }, 'USD', 'EUR'), 0.9);
  close(fxRate({ EURUSD: 1.25 }, 'USD', 'EUR'), 0.8);
  assert.equal(fxRate({}, 'JPY', 'EUR'), null);
});

test('sin cotización no se inventa valor', () => {
  const pf = computePortfolio([{ id: '1', brokerId: 'b', name: 'X', symbol: 'XXX', type: 'Large Caps', qty: 2, avgPrice: 10 }],
    { quotes: {}, fx: {}, currency: 'EUR', brokers: [{ id: 'b', currency: 'EUR' }] });
  assert.equal(pf.assets[0].missing, true);
  assert.equal(pf.rows[0].value, null);
});

test('compras recalculan el precio medio y las ventas no', () => {
  const p = { qty: 2, avgPrice: 100 };
  const b = applyTrade(p, { side: 'buy', qty: 2, price: 200 });
  assert.equal(b.qty, 4);
  assert.equal(b.avgPrice, 150);
  const s = applyTrade(b, { side: 'sell', qty: 1, price: 300 });
  assert.equal(s.qty, 3);
  assert.equal(s.avgPrice, 150);
  assert.equal(s.realized, 150);
});
