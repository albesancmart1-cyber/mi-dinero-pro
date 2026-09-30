// GET /api/quotes?symbols=MSFT,CSU.TO&ccy=USD,CAD&base=EUR
// Devuelve { quotes: { MSFT: {...} }, fx: { USDEUR: 0.87 }, base, time }
import { getMarketData } from './_lib/market.js';

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const split = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
    const symbols = split(q.symbols);
    const currencies = split(q.ccy).map((c) => c.toUpperCase());
    const base = String(q.base || 'EUR').toUpperCase();
    if (!/^[A-Z]{3}$/.test(base)) return res.status(400).json({ error: 'base inválida' });
    const data = await getMarketData(symbols, currencies, base);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
