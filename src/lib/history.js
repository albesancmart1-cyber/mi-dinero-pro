// Evolución del patrimonio: reconstruye el valor de la cartera (en tu divisa
// principal) con los precios y tipos de cambio históricos de cada fecha, total
// y por broker. Funciones puras, sin DOM.
//
// Cómo se calcula el valor en cada instante:
//   cantidad(t) × precio(t) × tipo de cambio(t) a la divisa principal
// La cantidad es la actual, ajustada con las compras/ventas registradas con
// "Operar" (si las hay). Las posiciones manuales (efectivo, fondos sin ticker)
// valen siempre lo mismo, convertido con el tipo de cambio de cada fecha.

import { fxRate, isMarketPosition } from './portfolio.js';

const DAY = 86_400_000;

export const PERIODS = [
  { id: '1d', label: '1D', title: 'Últimas 24 horas', range: '5d', interval: '15m' },
  { id: '1w', label: '1S', title: 'Última semana', range: '1mo', interval: '60m' },
  { id: '1m', label: '1M', title: 'Último mes', range: '1mo', interval: '1d' },
  { id: 'ytd', label: 'YTD', title: 'Lo que va de año', range: 'ytd', interval: '1d' },
  { id: '1y', label: '1A', title: 'Último año', range: '1y', interval: '1d' },
  { id: '5y', label: '5A', title: 'Últimos 5 años', range: '5y', interval: '1wk' },
];

export const periodById = (id) => PERIODS.find((p) => p.id === id) || PERIODS[2];

/** Instante (ms) desde el que se muestra cada periodo. */
export function periodStart(id, now = Date.now(), latestMs = null) {
  switch (id) {
    case '1d': return (latestMs ?? now) - DAY;
    case '1w': return now - 7 * DAY;
    case '1m': return now - 30 * DAY;
    case 'ytd': return new Date(new Date(now).getFullYear(), 0, 1).getTime();
    case '1y': return now - 365 * DAY;
    default: return 0; // 5a: todo lo que devuelve la fuente
  }
}

/** Último instante (ms) con datos en las series. */
export function latestTimestamp(series) {
  let m = 0;
  for (const s of Object.values(series || {})) if (s?.t?.length) m = Math.max(m, s.t[s.t.length - 1]);
  return m * 1000 || null;
}

/** Cantidad que se tenía en una fecha, deshaciendo las operaciones posteriores registradas. */
export function qtyAt(p, tsSec) {
  const cur = Number(p.qty) || 0;
  if (!p.trades?.length) return cur;
  const day = new Date(tsSec * 1000).toISOString().slice(0, 10);
  let q = cur;
  for (const t of p.trades) if (t.date > day) q += t.side === 'sell' ? Number(t.qty) || 0 : -(Number(t.qty) || 0);
  return Math.max(0, q);
}

/** Lector de una serie con "último valor conocido"; hay que consultarlo en orden creciente. */
function cursor(t, v) {
  let i = 0;
  return (ts) => {
    if (ts < t[0]) return v[0]; // antes del primer dato: se usa el primero
    while (i + 1 < t.length && t[i + 1] <= ts) i++;
    return v[i];
  };
}

const r2 = (x) => Math.round(x * 100) / 100;

/**
 * @param {object} o
 *  positions, brokers, currency
 *  series  { SIMBOLO: { c, t, v } }       fx { USDEUR: { t, v } }
 *  currentFx { USDEUR: 0.87 }             tipos actuales (respaldo y modo "sin efecto divisa")
 *  fxMode  'historic' | 'current'         con 'current' se usa el tipo de hoy en todas las fechas
 *  from/to ms, cash (saldo de cuentas que se suma al total), maxPoints
 * @returns {{ points: Array<{t:number,total:number,assets:number,cash:number,brokers:object}>, missing: string[], brokerIds: string[] }}
 */
export function buildPortfolioHistory(o) {
  const {
    positions = [], brokers = [], series = {}, fx = {}, currency = 'EUR', currentFx = {},
    fxMode = 'historic', from = 0, to = Infinity, cash = 0, maxPoints = 240,
  } = o;
  const missing = new Set();
  const rates = {};
  const rateOf = (ccy) => {
    if (ccy === currency) return () => 1;
    if (rates[ccy] !== undefined) return rates[ccy];
    let fn = null;
    const s = fx[`${ccy}${currency}`];
    if (fxMode === 'historic' && s?.t?.length) fn = cursor(s.t, s.v);
    else {
      const r = fxRate(currentFx, ccy, currency);
      if (r != null) fn = () => r;
    }
    rates[ccy] = fn;
    return fn;
  };

  const items = [];
  for (const p of positions) {
    const broker = brokers.find((b) => b.id === p.brokerId);
    const name = p.name || p.symbol;
    if (isMarketPosition(p)) {
      if (!((Number(p.qty) || 0) > 0 || p.trades?.length)) continue;
      const s = series[p.symbol];
      if (!s?.t?.length) { missing.add(name); continue; }
      const ccy = s.c || p.quoteCurrency || broker?.currency || currency;
      const rate = rateOf(ccy);
      if (!rate) { missing.add(`${name} (tipo de cambio ${ccy})`); continue; }
      items.push({ p, s, broker: p.brokerId, price: cursor(s.t, s.v), rate });
    } else {
      const val = Number(p.manualValue ?? p.avgPrice);
      if (!(val > 0)) continue;
      const ccy = broker?.currency || currency;
      const rate = rateOf(ccy);
      if (!rate) { missing.add(`${name} (tipo de cambio ${ccy})`); continue; }
      items.push({ p, broker: p.brokerId, fixed: val, rate });
    }
  }

  // Línea de tiempo: unión de las fechas de todas las series dentro de la ventana
  const stamps = new Set();
  for (const it of items) {
    if (!it.s) continue;
    for (const ts of it.s.t) { const ms = ts * 1000; if (ms >= from && ms <= to) stamps.add(ts); }
  }
  let times = [...stamps].sort((a, b) => a - b);
  if (!times.length) return { points: [], missing: [...missing], brokerIds: [] };
  if (times.length > maxPoints) {
    const step = (times.length - 1) / (maxPoints - 1);
    times = Array.from({ length: maxPoints }, (_, i) => times[Math.round(i * step)]);
  }

  const points = times.map((ts) => {
    const byBroker = {};
    let assets = 0;
    for (const it of items) {
      const v = (it.price ? qtyAt(it.p, ts) * it.price(ts) : it.fixed) * it.rate(ts);
      byBroker[it.broker] = (byBroker[it.broker] || 0) + v;
      assets += v;
    }
    for (const k of Object.keys(byBroker)) byBroker[k] = r2(byBroker[k]);
    return { t: ts * 1000, total: r2(assets + cash), assets: r2(assets), cash, brokers: byBroker };
  });
  const used = new Set(items.map((i) => i.broker));
  return { points, missing: [...missing], brokerIds: brokers.map((b) => b.id).filter((id) => used.has(id)) };
}

/** Cambio entre el primer y el último valor (≠ 0) de una serie de puntos. */
export function changeOver(points, pick = (p) => p.total) {
  const vals = points.map(pick).filter((v) => v != null);
  const first = vals.find((v) => v > 0);
  const last = vals[vals.length - 1];
  if (first == null || last == null) return { first: null, last: last ?? null, change: null, pct: null };
  return { first, last, change: r2(last - first), pct: last / first - 1 };
}

/** Filas para el gráfico por broker: valor en divisa o variación % desde el inicio. */
export function brokerChartData(points, brokerIds, mode = 'value') {
  const base = {};
  if (mode === 'pct') {
    for (const id of [...brokerIds, 'total']) {
      const f = points.map((p) => (id === 'total' ? p.assets : p.brokers[id])).find((v) => v > 0);
      base[id] = f || null;
    }
  }
  return points.map((p) => {
    const row = { x: p.t };
    for (const id of [...brokerIds, 'total']) {
      const v = id === 'total' ? p.assets : p.brokers[id] || 0;
      row[id] = mode === 'pct' ? (base[id] ? Math.round((v / base[id] - 1) * 10000) / 100 : null) : v;
    }
    return row;
  });
}
