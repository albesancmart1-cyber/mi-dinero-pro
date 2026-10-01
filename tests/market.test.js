import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseYahooChart, getMarketData } from '../api/_lib/market.js';

const chart = (meta, close = [], high = [], low = []) => ({
  chart: { result: [{ meta, indicators: { quote: [{ close, high, low }] } }], error: null },
});

test('normaliza la respuesta de Yahoo', () => {
  const q = parseYahooChart(chart(
    { symbol: 'MSFT', currency: 'USD', regularMarketPrice: 510, longName: 'Microsoft Corporation' },
    [480, 500, 510], [490, 520, 515], [470, 495, 505],
  ));
  assert.equal(q.price, 510);
  assert.equal(q.prevClose, 500);
  assert.equal(q.changePct, 510 / 500 - 1);
  assert.equal(q.high52, 520);
  assert.equal(q.low52, 470);
  assert.equal(q.name, 'Microsoft Corporation');
});

test('convierte peniques (GBp) a libras', () => {
  const q = parseYahooChart(chart({ symbol: 'ZEG.L', currency: 'GBp', regularMarketPrice: 812, fiftyTwoWeekHigh: 1000, fiftyTwoWeekLow: 500 }, [800, 812]));
  assert.equal(q.currency, 'GBP');
  assert.equal(q.price, 8.12);
  assert.equal(q.high52, 10);
  assert.equal(q.prevClose, 8);
});

test('respuesta vacía → null', () => {
  assert.equal(parseYahooChart({ chart: { result: null, error: { code: 'Not Found' } } }), null);
});

test('getMarketData pide cotizaciones y FX con un fetch simulado', async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(url);
    const sym = decodeURIComponent(url.split('/chart/')[1].split('?')[0]);
    const prices = { AAA: [100, 'USD'], 'USDEUR=X': [0.9, 'EUR'], 'CADEUR=X': [0.65, 'EUR'] };
    if (!prices[sym]) return { ok: false, status: 404 };
    const [p, c] = prices[sym];
    return { ok: true, json: async () => chart({ symbol: sym, currency: c, regularMarketPrice: p }, [p]) };
  };
  const d = await getMarketData(['AAA'], ['CAD'], 'EUR', fake);
  assert.equal(d.quotes.AAA.price, 100);
  assert.deepEqual(d.fx, { USDEUR: 0.9, CADEUR: 0.65 });
  assert.ok(calls.every((u) => u.includes('finance.yahoo.com')));
});
