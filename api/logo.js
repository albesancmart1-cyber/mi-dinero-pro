// GET /api/logo?d=mercadona.es → imagen del logo (cacheada 30 días en Vercel)
import { cleanDomain, findLogo } from './_lib/logo.js';

export default async function handler(req, res) {
  const domain = cleanDomain(req.query?.d);
  if (!domain) return res.status(400).end();
  const logo = await findLogo(domain);
  if (!logo) {
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(404).end();
  }
  res.setHeader('Content-Type', logo.type);
  res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=2592000');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  return res.status(200).send(logo.buf);
}
