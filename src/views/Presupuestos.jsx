import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { budgetFor, budgetStatus, monthOf, monthlyEquivalent, shiftMonth, todayISO } from '../lib/finance.js';
import { money, parseAmount } from '../lib/format.js';
import { Empty, Progress, Stat } from '../components/ui.jsx';
import { MonthPicker } from './Movimientos.jsx';
import { CategoryIcon } from '../components/icons.jsx';

export default function Presupuestos() {
  const { state, update } = useStore();
  const [month, setMonth] = useState(monthOf(todayISO()));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const cur = state.settings.currency;
  const st = budgetStatus(state, month);
  const hasOwn = !!state.budgets[month];
  const expenseCats = state.categories.filter((c) => c.type === 'expense');

  // Días transcurridos del mes → ritmo de gasto
  const isCurrent = month === monthOf(todayISO());
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const elapsed = isCurrent ? new Date().getDate() / days : month < monthOf(todayISO()) ? 1 : 0;

  const fixedIncome = state.recurring.filter((r) => r.active && r.type === 'income').reduce((s, r) => s + monthlyEquivalent(r), 0);
  const fixedExpense = state.recurring.filter((r) => r.active && r.type === 'expense').reduce((s, r) => s + monthlyEquivalent(r), 0);

  function startEdit() {
    const b = budgetFor(state, month);
    setDraft(Object.fromEntries(expenseCats.map((c) => [c.id, b[c.id] ? String(b[c.id]).replace('.', ',') : ''])));
    setEditing(true);
  }

  function saveDraft(asTemplate) {
    const clean = {};
    for (const [k, v] of Object.entries(draft)) {
      const n = parseAmount(v);
      if (n > 0) clean[k] = Math.round(n * 100) / 100;
    }
    update((s) => ({
      ...s,
      budgets: { ...s.budgets, [month]: clean },
      budgetTemplate: asTemplate ? clean : s.budgetTemplate,
    }));
    setEditing(false);
  }

  function copyPrev() {
    const prev = state.budgets[shiftMonth(month, -1)] || state.budgetTemplate;
    update((s) => ({ ...s, budgets: { ...s.budgets, [month]: { ...prev } } }));
  }

  function suggestFromFixed() {
    // Suma los fijos de gasto de cada categoría como punto de partida
    const next = { ...draft };
    state.recurring.filter((r) => r.active && r.type === 'expense').forEach((r) => {
      const cur0 = parseAmount(next[r.categoryId]) || 0;
      next[r.categoryId] = String(Math.round((cur0 + monthlyEquivalent(r)) * 100) / 100).replace('.', ',');
    });
    setDraft(next);
  }

  const draftTotal = Object.values(draft).reduce((s, v) => s + (parseAmount(v) || 0), 0);

  return (
    <>
      <div className="page-head">
        <div><h1>Presupuestos</h1><div className="sub">Límite de gasto mensual por categoría</div></div>
        <MonthPicker month={month} setMonth={setMonth} />
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label="Presupuestado" value={money(st.totalLimit, cur)} />
        <Stat label="Gastado" value={money(st.totalSpent, cur)}
          delta={st.totalLimit > 0 ? `${Math.round((st.totalSpent / st.totalLimit) * 100)}% del presupuesto` : null} />
        <Stat label="Disponible" value={money(st.remaining, cur)} deltaClass={st.remaining >= 0 ? 'pos' : 'neg'}
          delta={isCurrent && st.remaining > 0 ? `${money(st.remaining / Math.max(1, days - new Date().getDate() + 1), cur)}/día hasta fin de mes` : null} />
        <Stat label="Fijos al mes" value={money(fixedIncome - fixedExpense, cur)}
          delta={`${money(fixedIncome, cur)} ingresos − ${money(fixedExpense, cur)} gastos`} />
      </div>

      {!editing ? (
        <div className="card">
          <div className="card-head">
            <h2>Categorías</h2>
            <div className="row">
              {!hasOwn && Object.keys(state.budgetTemplate).length > 0 && <span className="badge">Usando plantilla</span>}
              <button className="btn sm" onClick={copyPrev}>Copiar mes anterior</button>
              <button className="btn sm primary" onClick={startEdit}>Editar presupuesto</button>
            </div>
          </div>
          {st.rows.length === 0 && <Empty>Aún no hay presupuesto para este mes. Pulsa <b>Editar presupuesto</b> para crearlo.</Empty>}
          <div className="stack">
            {st.rows.map((r) => (
              <div key={r.category.id}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <CategoryIcon cat={r.category} size={30} />
                  <span style={{ fontWeight: 560 }}>{r.category.name}</span>
                  <span className="spacer" />
                  <span className="tnum small">
                    <b>{money(r.spent, cur)}</b>
                    <span className="muted"> / {r.limit > 0 ? money(r.limit, cur) : 'sin límite'}</span>
                  </span>
                </div>
                <Progress ratio={r.limit > 0 ? r.ratio : r.spent > 0 ? 1.01 : 0} mark={r.limit > 0 && elapsed > 0 && elapsed < 1 ? elapsed : null} />
                <div className="small muted" style={{ marginTop: 4 }}>
                  {r.limit > 0
                    ? r.remaining >= 0 ? `Quedan ${money(r.remaining, cur)}` : <span className="neg">Te has pasado {money(-r.remaining, cur)}</span>
                    : 'Gasto sin presupuesto asignado'}
                </div>
              </div>
            ))}
          </div>
          {elapsed > 0 && elapsed < 1 && <p className="small muted" style={{ marginTop: 16 }}>La marca vertical indica cuánto del mes ha pasado: si la barra la supera, vas por encima del ritmo.</p>}
        </div>
      ) : (
        <div className="card">
          <div className="card-head">
            <h2>Editar presupuesto · total {money(draftTotal, cur)}</h2>
            <button className="btn sm" onClick={suggestFromFixed}>Sumar gastos fijos</button>
          </div>
          <div className="form-grid">
            {expenseCats.map((c) => (
              <label className="field" key={c.id}>
                <span className="row"><CategoryIcon cat={c} size={22} />{c.name}</span>
                <input className="input" inputMode="decimal" placeholder="0" value={draft[c.id] || ''}
                  onChange={(e) => setDraft({ ...draft, [c.id]: e.target.value })} />
              </label>
            ))}
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setEditing(false)}>Cancelar</button>
            <button className="btn" onClick={() => saveDraft(false)}>Guardar solo este mes</button>
            <button className="btn primary" onClick={() => saveDraft(true)}>Guardar y usar como plantilla</button>
          </div>
          <p className="small muted">La plantilla se aplica automáticamente a los meses que no tengan presupuesto propio.</p>
        </div>
      )}
    </>
  );
}
