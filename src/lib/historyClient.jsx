import { useEffect, useMemo, useState } from 'react';
import { useStore } from './store.jsx';
import { useMarket } from './market.jsx';
import { buildPortfolioHistory, latestTimestamp, periodById, periodStart } from './history.js';
import { isMarketPosition, neededCurrencies } from './portfolio.js';

const cache = new Map();    // url → { at, data }
const inflight = new Map(); // url → Promise
const TTL_INTRADAY = 3 * 60_000;
const TTL_DAILY = 30 * 60_000;

async function load(url, intraday, force) {
  const hit = cache.get(url);
  if (!force && hit && Date.now() - hit.at < (intraday ? TTL_INTRADAY : TTL_DAILY)) return hit.data;
  if (inflight.has(url)) return inflight.get(url);
  const p = fetch(url).then(async (r) => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    cache.set(url, { at: Date.now(), data: d });
    return d;
  }).finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

/**
 * Evolución del patrimonio de la cartera para un periodo (1d, 1w, 1m, ytd, 1y, 5y):
 * descarga los precios y tipos de cambio históricos y los combina con tus posiciones.
 */
export function usePortfolioHistory(periodId, { fxMode = 'historic', cash = 0 } = {}) {
  const { state } = useStore();
  const { quotes, fx: currentFx } = useMarket();
  const period = periodById(periodId);
  const currency = state.settings.currency;
  const [raw, setRaw] = useState(null);
  const [status, setStatus] = useState({ loading: false, error: null });
  const [tick, setTick] = useState(0);

  const symbols = useMemo(
    () => [...new Set(state.positions.filter((p) => isMarketPosition(p) && ((Number(p.qty) || 0) > 0 || p.trades?.length)).map((p) => p.symbol.trim()))].sort(),
    [state.positions],
  );
  const ccys = useMemo(
    () => neededCurrencies(state.positions, state.brokers, quotes, currency),
    [state.positions, state.brokers, quotes, currency],
  );
  const intraday = period.interval.endsWith('m');
  const url = `/api/history?symbols=${encodeURIComponent(symbols.join(','))}&ccy=${encodeURIComponent(ccys.join(','))}&base=${currency}&range=${period.range}&interval=${period.interval}`;
  const hasData = symbols.length > 0 || state.positions.some((p) => !isMarketPosition(p));

  useEffect(() => {
    if (!symbols.length) { setRaw({ series: {}, fx: {} }); return undefined; }
    let alive = true;
    setStatus({ loading: true, error: null });
    load(url, intraday, tick > 0)
      .then((d) => { if (alive) { setRaw(d); setStatus({ loading: false, error: null }); } })
      .catch((e) => { if (alive) setStatus({ loading: false, error: e.message }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick]);

  // El periodo de 24 h se actualiza solo cada 5 minutos
  useEffect(() => {
    if (periodId !== '1d') return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') setTick((n) => n + 1); }, 5 * 60_000);
    return () => clearInterval(t);
  }, [periodId]);

  const built = useMemo(() => {
    if (!raw) return null;
    const latest = latestTimestamp(raw.series);
    return buildPortfolioHistory({
      positions: state.positions, brokers: state.brokers, series: raw.series || {}, fx: raw.fx || {},
      currency, currentFx, fxMode, cash,
      from: periodStart(period.id, Date.now(), latest),
    });
  }, [raw, state.positions, state.brokers, currency, currentFx, fxMode, cash, period.id]);

  return {
    period, hasData,
    points: built?.points || [], missing: built?.missing || [], brokerIds: built?.brokerIds || [],
    loading: status.loading, error: status.error,
    refresh: () => setTick((n) => n + 1),
  };
}
