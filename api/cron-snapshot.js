// api/cron-snapshot.js
// Lo llama el workflow de GitHub (.github/workflows/snapshot.yml).
// Lee la cartera guardada por la app en Firestore, pide precios reales,
// calcula con la misma lógica que el frontend y guarda un snapshot diario
// (un documento por día en usuarios/mi-dinero-pro/history/{YYYY-MM-DD}).

import { firebaseConfigured, mainDoc } from './_lib/firebase.js';
import { getMarketData } from './_lib/market.js';
import { computePortfolio, isMarketPosition, neededCurrencies } from '../src/lib/portfolio.js';
import { monthTotals } from '../src/lib/finance.js';

export default async function handler(req, res) {
  try {
    if (!firebaseConfigured()) return res.status(200).json({ skip: 'firebase no configurado' });
    const ref = mainDoc();
    const snap = await ref.get();
    const raw = snap.exists ? snap.data()?.appState : null;
    if (!raw) return res.status(200).json({ skip: 'sin datos de la app' });
    const state = JSON.parse(raw);
    const positions = state.positions || [];
    const brokers = state.brokers || [];
    const currency = state.settings?.currency || 'EUR';
    if (!positions.length) return res.status(200).json({ skip: 'sin posiciones' });

    const symbols = positions.filter(isMarketPosition).map((p) => p.symbol);
    const ccys = neededCurrencies(positions, brokers, {}, currency);
    const { quotes, fx } = await getMarketData(symbols, ccys, currency);
    const pf = computePortfolio(positions, { quotes, fx, currency, brokers, targetAmount: state.settings?.targetAmount });

    const date = new Date().toISOString().slice(0, 10);
    const cash = (state.accounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
    const doc = {
      date,
      ts: Date.now(),
      value: pf.totalValue,
      invested: pf.totalInvested,
      returnPct: pf.returnPct,
      netWorth: pf.totalValue + cash,
      monthExpense: monthTotals(state.transactions || [], date.slice(0, 7)).expense,
      currency,
      source: 'cron',
    };
    await ref.collection('history').doc(date).set(doc);
    res.status(200).json({ ok: true, ...doc });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
