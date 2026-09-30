// GET /api/search?q=constellation → [{ symbol, name, exchange, type }]
import { searchSymbols } from './_lib/market.js';

export default async function handler(req, res) {
  try {
    const q = String(req.query?.q || '').trim();
    if (q.length < 1) return res.status(200).json({ results: [] });
    const results = await searchSymbols(q.slice(0, 60));
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
