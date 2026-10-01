// Datos de mercado gratuitos:
//  - Yahoo Finance (sin API key): acciones de cualquier bolsa, ETFs, fondos,
//    cripto (BTC-EUR) y divisas (USDEUR=X).
//  - Finnhub (opcional, FINNHUB_KEY): respaldo para acciones de EE. UU.
//  - open.er-api.com: respaldo para tipos de cambio.
// Los ficheros de api/_lib no se exponen como endpoints en Vercel.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const CACHE_TTL = 60_000;
const cache = new Map();

// Subunidades que Yahoo usa en algunas bolsas (p. ej. Londres cotiza en peniques).
const SUBUNITS = { GBp: ['GBP', 100], GBX: ['GBP', 100], ZAc: ['ZAR', 100], ILA: ['ILS', 100] };

function cached(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_TTL) return hit.v;
  return undefined;
}

async function fetchJson(url, fetchImpl = fetch) {
  const r = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Convierte la respuesta de /v8/finance/chart en una cotización normalizada. */
export function parseYahooChart(json) {
  const res = json?.chart?.result?.[0];
  if (!res?.meta) return null;
  const m = res.meta;
  const q = res.indicators?.quote?.[0] || {};
  const closes = (q.close || []).filter((x) => x != null);
  const highs = (q.high || []).filter((x) => x != null);
  const lows = (q.low || []).filter((x) => x != null);

  let price = m.regularMarketPrice ?? closes[closes.length - 1];
  if (price == null) return null;
  let prev = closes.length >= 2 ? closes[closes.length - 2] : m.previousClose ?? m.chartPreviousClose;
  let high52 = m.fiftyTwoWeekHigh ?? (highs.length ? Math.max(...highs) : null);
  let low52 = m.fiftyTwoWeekLow ?? (lows.length ? Math.min(...lows) : null);
  let currency = m.currency || null;

  const sub = SUBUNITS[currency];
  if (sub) {
    const [c, div] = sub;
    currency = c;
    price /= div;
    if (prev != null) prev /= div;
    if (high52 != null) high52 /= div;
    if (low52 != null) low52 /= div;
  }

  return {
    symbol: m.symbol,
    name: m.longName || m.shortName || m.symbol,
    price,
    prevClose: prev ?? null,
    changePct: prev ? price / prev - 1 : null,
    currency,
    high52,
    low52,
    exchange: m.fullExchangeName || m.exchangeName || null,
    type: m.instrumentType || null,
    time: m.regularMarketTime ? m.regularMarketTime * 1000 : Date.now(),
    source: 'yahoo',
  };
}

async function yahooQuote(symbol, fetchImpl) {
  let lastErr;
  for (const host of YAHOO_HOSTS) {
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d&includePrePost=false`;
      const q = parseYahooChart(await fetchJson(url, fetchImpl));
      if (q) return q;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Sin datos');
}

async function finnhubQuote(symbol, fetchImpl) {
  const key = process.env.FINNHUB_KEY;
  if (!key || /[.=^-]/.test(symbol)) return null;
  const d = await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`, fetchImpl);
  if (!(d?.c > 0)) return null;
  return {
    symbol,
    name: symbol,
    price: d.c,
    prevClose: d.pc || null,
    changePct: d.pc ? d.c / d.pc - 1 : null,
    currency: 'USD',
    high52: null,
    low52: null,
    time: d.t ? d.t * 1000 : Date.now(),
    source: 'finnhub',
  };
}

/** Cotización de un símbolo con caché y respaldo. */
export async function getQuote(symbol, fetchImpl = fetch) {
  const key = `q:${symbol}`;
  const hit = cached(key);
  if (hit !== undefined) return hit;
  let q = null;
  try {
    q = await yahooQuote(symbol, fetchImpl);
  } catch {
    try { q = await finnhubQuote(symbol, fetchImpl); } catch { q = null; }
  }
  if (q) cache.set(key, { t: Date.now(), v: q });
  return q;
}

/** Tipos de cambio de cada divisa → `base`. Devuelve { USDEUR: 0.87, ... }. */
export async function getFx(currencies, base, fetchImpl = fetch) {
  const out = {};
  const missing = [];
  await Promise.all(
    currencies.filter((c) => c && c !== base).map(async (c) => {
      const q = await getQuote(`${c}${base}=X`, fetchImpl);
      if (q?.price > 0) out[`${c}${base}`] = q.price;
      else missing.push(c);
    }),
  );
  if (missing.length) {
    try {
      const d = await fetchJson(`https://open.er-api.com/v6/latest/${base}`, fetchImpl);
      for (const c of missing) if (d?.rates?.[c] > 0) out[`${c}${base}`] = 1 / d.rates[c];
    } catch { /* sin respaldo */ }
  }
  return out;
}

/** Buscador de valores (nombre o ticker). */
export async function searchSymbols(q, fetchImpl = fetch) {
  const key = `s:${q.toLowerCase()}`;
  const hit = cached(key);
  if (hit !== undefined) return hit;
  let results = [];
  for (const host of YAHOO_HOSTS) {
    try {
      const d = await fetchJson(
        `${host}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&listsCount=0&enableFuzzyQuery=true`,
        fetchImpl,
      );
      results = (d.quotes || [])
        .filter((x) => x.symbol)
        .map((x) => ({
          symbol: x.symbol,
          name: x.longname || x.shortname || x.symbol,
          exchange: x.exchDisp || x.exchange || '',
          type: x.quoteType || '',
        }));
      break;
    } catch { /* probar siguiente host */ }
  }
  if (!results.length && process.env.FINNHUB_KEY) {
    try {
      const d = await fetchJson(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${process.env.FINNHUB_KEY}`, fetchImpl);
      results = (d.result || []).slice(0, 10).map((x) => ({ symbol: x.symbol, name: x.description, exchange: '', type: x.type }));
    } catch { /* nada */ }
  }
  cache.set(key, { t: Date.now(), v: results });
  return results;
}

/** Cotizaciones + FX en una llamada. */
export async function getMarketData(symbols, currencies, base, fetchImpl = fetch) {
  const quotes = {};
  const list = [...new Set(symbols.filter(Boolean))].slice(0, 80);
  // Lotes de 8 para no saturar a Yahoo
  for (let i = 0; i < list.length; i += 8) {
    await Promise.all(list.slice(i, i + 8).map(async (s) => {
      const q = await getQuote(s, fetchImpl);
      if (q) quotes[s] = q;
    }));
  }
  const ccys = new Set(currencies);
  for (const q of Object.values(quotes)) if (q.currency) ccys.add(q.currency);
  const fx = await getFx([...ccys], base, fetchImpl);
  return { quotes, fx, base, time: Date.now() };
}
