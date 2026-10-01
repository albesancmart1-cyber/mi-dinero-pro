// GET /api/history?symbols=MSFT,CSU.TO&ccy=USD,CAD&base=EUR&range=1y&interval=1d
// → { series: { MSFT: { c, t, v } }, fx: { USDEUR: { t, v } }, ... }
import { INTERVALS, RANGES, SYMBOL_RE, getMarketHistory } from './_lib/history.js';

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const split = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
    const symbols = split(q.symbols);
    const currencies = split(q.ccy).map((c) => c.toUpperCase());
    const base = String(q.base || 'EUR').toUpperCase();
    const range = String(q.range || '1y');
    const interval = String(q.interval || '1d');
    if (!/^[A-Z]{3}$/.test(base) || !RANGES.has(range) || !INTERVALS.has(interval)) return res.status(400).json({ error: 'parámetros no válidos' });
    if (symbols.some((s) => !SYMBOL_RE.test(s)) || currencies.some((c) => !/^[A-Z]{3}$/.test(c))) return res.status(400).json({ error: 'símbolo no válido' });
    const data = await getMarketHistory(symbols, currencies, base, range, interval);
    res.setHeader('Cache-Control', `s-maxage=${interval.endsWith('m') ? 300 : 1800}, stale-while-revalidate=3600`);
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
