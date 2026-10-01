// Busca el logo de una marca a partir de su dominio.
// Orden: apple-touch-icon de la propia web (180 px, diseñado por la marca),
// favicon grande de Google y, como último recurso, el de DuckDuckGo.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const DOMAIN_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const MIN_GOOD = 64; // px: por debajo seguimos buscando uno mejor

export function cleanDomain(d) {
  const v = String(d || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  return DOMAIN_RE.test(v) ? v : null;
}

/** Ancho de un PNG/ICO a partir de su cabecera (null si no se sabe). */
export function imageWidth(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) return buf.readUInt32BE(16);
  if (buf.length > 6 && buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) return buf[6] || 256;
  return null;
}

export function sources(domain) {
  return [
    `https://${domain}/apple-touch-icon.png`,
    `https://www.${domain}/apple-touch-icon.png`,
    `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
}

export async function findLogo(domain, fetchImpl = fetch) {
  let fallback = null;
  for (const url of sources(domain)) {
    try {
      const r = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'image/*' }, redirect: 'follow', signal: AbortSignal.timeout(4000) });
      if (!r.ok) continue;
      const type = (r.headers.get('content-type') || '').split(';')[0].trim();
      if (!type.startsWith('image/')) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 100 || buf.length > 600_000) continue;
      const w = imageWidth(buf);
      const hit = { type, buf, width: w };
      if (w == null || w >= MIN_GOOD) return hit;
      if (!fallback || (fallback.width || 0) < w) fallback = hit;
    } catch { /* probar la siguiente fuente */ }
  }
  return fallback;
}
