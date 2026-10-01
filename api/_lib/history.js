// Histórico de precios (Yahoo Finance) para reconstruir la evolución del patrimonio.
// Devuelve series compactas { c: divisa, t: [segundos], v: [cierres] } por símbolo
// y por par de divisas (USDEUR=X → clave "USDEUR").

import { fetchJson, YAHOO_HOSTS, SUBUNITS } from './market.js';

export const RANGES = new Set(['5d', '1mo', '3mo', '6mo', 'ytd', '1y', '2y', '5y', '10y', 'max']);
export const INTERVALS = new Set(['5m', '15m', '30m', '60m', '1d', '1wk']);
export const SYMBOL_RE = /^[A-Za-z0-9.\-=^]{1,20}$/;

const cache = new Map();
const ttl = (interval) => (interval.endsWith('m') ? 300_000 : 1_800_000); // intradía 5 min, resto 30 min

/** Convierte la respuesta de /v8/finance/chart en una serie compacta. */
export function parseHistory(json) {
  const res = json?.chart?.result?.[0];
  const closes = res?.indicators?.quote?.[0]?.close;
  if (!res?.timestamp || !closes) return null;
  let currency = res.meta?.currency || null;
  let div = 1;
  const sub = SUBUNITS[currency]; // Londres: peniques → libras
  if (sub) { currency = sub[0]; div = sub[1]; }
  const t = [], v = [];
  for (let i = 0; i < res.timestamp.length; i++) {
    const c = closes[i];
    if (c == null || !(c > 0)) continue;
    t.push(res.timestamp[i]);
    v.push(Number((c / div).toPrecision(8)));
  }
  return t.length ? { c: currency, t, v } : null;
}

export async function getHistory(symbol, range, interval, fetchImpl = fetch) {
  const key = `${symbol}|${range}|${interval}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl(interval)) return hit.v;
  let out = null;
  for (const host of YAHOO_HOSTS) {
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
      out = parseHistory(await fetchJson(url, fetchImpl));
      if (out) break;
    } catch { /* probar el siguiente host */ }
  }
  if (out) cache.set(key, { at: Date.now(), v: out });
  return out;
}

/** Series de los símbolos y de los tipos de cambio a la divisa base. */
export async function getMarketHistory(symbols, currencies, base, range, interval, fetchImpl = fetch) {
  const series = {};
  const list = [...new Set(symbols)].slice(0, 60);
  for (let i = 0; i < list.length; i += 6) {
    await Promise.all(list.slice(i, i + 6).map(async (s) => {
      const h = await getHistory(s, range, interval, fetchImpl);
      if (h) series[s] = h;
    }));
  }
  const ccys = new Set(currencies);
  for (const s of Object.values(series)) if (s.c) ccys.add(s.c);
  const fx = {};
  await Promise.all([...ccys].filter((c) => c && c !== base).map(async (c) => {
    const h = await getHistory(`${c}${base}=X`, range, interval, fetchImpl);
    if (h) fx[`${c}${base}`] = h;
  }));
  return { series, fx, range, interval, base, time: Date.now() };
}
