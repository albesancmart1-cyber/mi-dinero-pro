import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES_VERSION, defaultState, uid, upgradeCategories } from './defaults.js';
import { materializeRecurring, todayISO } from './finance.js';

const KEY = 'mi-dinero-pro:v1';
const PIN_KEY = 'mi-dinero-pro:pin';

function safeGet(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function safeSet(k, v) {
  try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ }
}

function migrate(s) {
  const d = defaultState();
  return {
    ...d,
    ...s,
    settings: { ...d.settings, ...(s?.settings || {}), rules: { ...(s?.settings?.rules || {}) } },
    // Al subir de versión se añaden las categorías nuevas (solo una vez, para respetar borrados)
    categories: s?.categories?.length
      ? ((s.categoriesVersion || 1) < CATEGORIES_VERSION ? upgradeCategories(s.categories) : s.categories)
      : d.categories,
    categoriesVersion: CATEGORIES_VERSION,
  };
}

function load() {
  const raw = safeGet(KEY);
  if (!raw) return defaultState();
  try { return migrate(JSON.parse(raw)); } catch { return defaultState(); }
}

/** Aplica recurrentes vencidos (nómina, suscripciones…) como movimientos. */
function applyRecurring(state) {
  const { transactions, recurring } = materializeRecurring(state.recurring, todayISO(), uid);
  if (!transactions.length) return state;
  return { ...state, recurring, transactions: [...state.transactions, ...transactions] };
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState(() => applyRecurring(load()));
  const [pin, setPinState] = useState(() => safeGet(PIN_KEY) || '');
  const [sync, setSync] = useState({ status: 'off', message: '' });
  const [history, setHistory] = useState([]);
  const pushTimer = useRef(null);
  const skipPush = useRef(false);

  useEffect(() => { safeSet(KEY, JSON.stringify(state)); }, [state]);

  const update = useCallback((fn) => {
    setState((s) => {
      const next = typeof fn === 'function' ? fn(s) : { ...s, ...fn };
      return { ...applyRecurring(next), updatedAt: Date.now() };
    });
  }, []);

  // ---- Sincronización con el servidor (opcional, con PIN) ----
  const pull = useCallback(async (p = pin) => {
    if (!p) return;
    setSync({ status: 'syncing', message: 'Sincronizando…' });
    try {
      const r = await fetch('/api/state', { headers: { 'x-app-pin': p } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setHistory(d.snapshots || []);
      if (d.state && (d.updatedAt || 0) > (state.updatedAt || 0)) {
        skipPush.current = true;
        setState(applyRecurring(migrate(d.state)));
      } else if ((state.updatedAt || 0) > (d.updatedAt || 0)) {
        await push(p, state);
      }
      setSync({ status: 'ok', message: 'Sincronizado' });
    } catch (e) {
      setSync({ status: 'error', message: e.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, state.updatedAt]);

  async function push(p, s) {
    const r = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-app-pin': p },
      body: JSON.stringify({ state: s }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || `HTTP ${r.status}`);
    }
  }

  // Descarga inicial
  useEffect(() => { if (pin) pull(pin); /* eslint-disable-next-line */ }, [pin]);

  // Subida con retardo tras cada cambio
  useEffect(() => {
    if (!pin || !state.updatedAt) return;
    if (skipPush.current) { skipPush.current = false; return; }
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      try {
        setSync({ status: 'syncing', message: 'Guardando…' });
        await push(pin, state);
        setSync({ status: 'ok', message: 'Sincronizado' });
      } catch (e) {
        setSync({ status: 'error', message: e.message });
      }
    }, 1500);
    return () => clearTimeout(pushTimer.current);
  }, [state, pin]);

  const setPin = useCallback((p) => {
    safeSet(PIN_KEY, p);
    setPinState(p);
    if (!p) setSync({ status: 'off', message: '' });
  }, []);

  const value = useMemo(
    () => ({ state, update, pin, setPin, sync, pull, history }),
    [state, update, pin, setPin, sync, pull, history],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  return useContext(Ctx);
}
