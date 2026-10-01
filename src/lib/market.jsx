import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './store.jsx';
import { computePortfolio, isMarketPosition, neededCurrencies } from './portfolio.js';
import { todayISO } from './finance.js';

const CACHE_KEY = 'mi-dinero-pro:quotes';
const REFRESH_MS = 60_000;

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || { quotes: {}, fx: {} }; } catch { return { quotes: {}, fx: {} }; }
}

const Ctx = createContext(null);

/** Cotizaciones en tiempo real (refresco cada minuto con la app visible). */
export function MarketProvider({ children }) {
  const { state, update } = useStore();
  const [data, setData] = useState(readCache);
  const [status, setStatus] = useState({ loading: false, error: null, time: data.time || null });
  const currency = state.settings.currency;

  const symbols = useMemo(() => {
    const s = new Set(state.positions.filter(isMarketPosition).map((p) => p.symbol.trim()));
    s.add('^GSPC'); // Situación de mercado (hoja Análisis)
    return [...s].sort();
  }, [state.positions]);

  const ccys = useMemo(
    () => neededCurrencies(state.positions, state.brokers, data.quotes, currency),
    [state.positions, state.brokers, data.quotes, currency],
  );

  const key = `${symbols.join(',')}|${ccys.join(',')}|${currency}`;
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus((s) => ({ ...s, loading: true }));
    try {
      const url = `/api/quotes?symbols=${encodeURIComponent(symbols.join(','))}&ccy=${encodeURIComponent(ccys.join(','))}&base=${currency}`;
      const r = await fetch(url);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setData((prev) => {
        const next = { quotes: { ...prev.quotes, ...d.quotes }, fx: { ...prev.fx, ...d.fx }, time: d.time };
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* */ }
        return next;
      });
      const missing = symbols.filter((s) => !d.quotes[s]);
      setStatus({ loading: false, error: missing.length ? `Sin cotización: ${missing.join(', ')}` : null, time: d.time });
    } catch (e) {
      setStatus((s) => ({ ...s, loading: false, error: `No se pudieron obtener cotizaciones (${e.message})` }));
    } finally {
      inFlight.current = false;
    }
  }, [symbols, ccys, currency]);

  useEffect(() => {
    refresh();
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const portfolio = useMemo(
    () => computePortfolio(state.positions, {
      quotes: data.quotes,
      fx: data.fx,
      currency,
      brokers: state.brokers,
      targetAmount: state.settings.targetAmount,
    }),
    [state.positions, state.brokers, data, currency, state.settings.targetAmount],
  );

  // Snapshot diario local para el gráfico de evolución
  useEffect(() => {
    if (!status.time || !portfolio.totalValue || portfolio.assets.some((a) => a.missing)) return;
    const date = todayISO();
    const last = state.history[state.history.length - 1];
    const cash = state.accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
    const snap = {
      date,
      value: Math.round(portfolio.totalValue * 100) / 100,
      invested: Math.round(portfolio.totalInvested * 100) / 100,
      netWorth: Math.round((portfolio.totalValue + cash) * 100) / 100,
    };
    if (last && last.date === date && Math.abs(last.value - snap.value) < 1 && last.netWorth === snap.netWorth) return;
    update((s) => ({
      ...s,
      history: [...s.history.filter((h) => h.date !== date), snap].slice(-1500),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.time]);

  const value = useMemo(
    () => ({ quotes: data.quotes, fx: data.fx, status, refresh, portfolio }),
    [data, status, refresh, portfolio],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMarket() {
  return useContext(Ctx);
}

export { searchSymbols } from './api.js';
