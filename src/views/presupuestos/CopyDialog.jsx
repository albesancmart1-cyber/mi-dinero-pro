import { useState } from 'react';
import { useStore } from '../../lib/store.jsx';
import { copyBudgetMonth, effectiveValue, monthsOfYear } from '../../lib/budget.js';
import { money, monthLabel } from '../../lib/format.js';
import { Field, Modal } from '../../components/ui.jsx';

const MON = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Copia el presupuesto de un mes a uno o varios meses (de cualquier año). */
export default function CopyDialog({ from: initialFrom, onClose }) {
  const { state, update } = useStore();
  const cur = state.settings.currency;
  const [from, setFrom] = useState(initialFrom);
  const [year, setYear] = useState(Number(initialFrom.slice(0, 4)));
  const [targets, setTargets] = useState(() => new Set());
  const [propagate, setPropagate] = useState(true);
  const cats = state.budgetCats || [];
  const catById = Object.fromEntries(state.categories.map((c) => [c.id, c]));

  const sums = { income: 0, expense: 0, investment: 0 };
  let lines = 0;
  for (const id of cats) {
    const v = effectiveValue(state.budgets, id, from, state.budgetTemplate);
    if (v > 0 && catById[id]) { sums[catById[id].type] += v; lines++; }
  }

  const months = monthsOfYear(year);
  const toggle = (m) => setTargets((p) => { const n = new Set(p); n.has(m) ? n.delete(m) : n.add(m); return n; });
  const chosen = [...targets].filter((m) => m !== from).sort();
  const valid = chosen.length > 0 && cats.length > 0 && /^\d{4}-\d{2}$/.test(from);

  function apply() {
    update((s) => ({ ...s, budgets: copyBudgetMonth(s.budgets, s.budgetCats || [], from, chosen, { propagate, template: s.budgetTemplate }) }));
    onClose();
  }

  return (
    <Modal title="Copiar presupuesto" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!valid} onClick={apply}>
          {chosen.length ? `Copiar a ${chosen.length} ${chosen.length === 1 ? 'mes' : 'meses'}` : 'Copiar'}
        </button>
      </>}>
      <div className="stack">
        <Field label="Copiar el presupuesto de">
          <input type="month" className="input" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </Field>
        <div className="alert info">
          <span>
            {monthLabel(from)}: {lines} {lines === 1 ? 'categoría' : 'categorías'} ·
            ingresos <b>{money(sums.income, cur)}</b> · gastos <b>{money(sums.expense, cur)}</b> · inversión <b>{money(sums.investment, cur)}</b>
          </span>
        </div>

        <div>
          <div className="row" style={{ marginBottom: 8 }}>
            <h3>Pegar en</h3>
            <span className="spacer" />
            <button type="button" className="btn sm ghost" onClick={() => setYear(year - 1)} aria-label="Año anterior">‹</button>
            <b className="tnum">{year}</b>
            <button type="button" className="btn sm ghost" onClick={() => setYear(year + 1)} aria-label="Año siguiente">›</button>
          </div>
          <div className="chips">
            {months.map((m, i) => (
              <button type="button" key={m} className={`chip${targets.has(m) ? ' on' : ''}`} disabled={m === from} onClick={() => toggle(m)}>{MON[i]}</button>
            ))}
          </div>
          <div className="row wrap" style={{ marginTop: 8 }}>
            <button type="button" className="btn sm" onClick={() => setTargets(new Set([...targets, ...months.filter((m) => m > from)]))}>Meses siguientes del año</button>
            <button type="button" className="btn sm" onClick={() => setTargets(new Set([...targets, ...months]))}>Todo el año</button>
            <button type="button" className="btn sm ghost" onClick={() => setTargets(new Set())}>Limpiar</button>
          </div>
          {chosen.length > 0 && <p className="small muted" style={{ margin: '8px 0 0' }}>Seleccionados: {chosen.map((m) => monthLabel(m, true)).join(', ')}</p>}
        </div>

        <label className="check">
          <input type="checkbox" checked={propagate} onChange={(e) => setPropagate(e.target.checked)} />
          <span>También en los meses siguientes, hasta el próximo mes que hayas personalizado</span>
        </label>
        <p className="small muted" style={{ margin: 0 }}>
          Los meses elegidos quedan igual que {monthLabel(from)}, categoría por categoría (si no está en el mes de origen, queda a 0).
          Desmarca la casilla para que solo cambien los meses elegidos.
        </p>
      </div>
    </Modal>
  );
}
