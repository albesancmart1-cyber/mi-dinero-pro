import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { budgetFor, budgetStatus, expectedInMonth, monthOf, shiftMonth, todayISO } from '../lib/finance.js';
import { money, parseAmount } from '../lib/format.js';
import { Empty, Progress, Stat } from '../components/ui.jsx';
import { MonthPicker } from './Movimientos.jsx';
import { CategoryIcon } from '../components/icons.jsx';

// Los tres bloques del presupuesto
const BLOCKS = [
  {
    type: 'income', title: 'Ingresos', goal: true,
    planned: 'Previsto', actual: 'Recibido',
    left: (r, fmt) => (r.remaining > 0 ? `Faltan por recibir ${fmt(r.remaining)}` : r.limit > 0 ? 'Recibido ✓' : 'Ingreso no previsto'),
    empty: 'Indica cuánto esperas ingresar (nómina, extras…).',
  },
  {
    type: 'expense', title: 'Gastos', goal: false,
    planned: 'Presupuestado', actual: 'Gastado',
    left: (r, fmt) => (r.limit > 0 ? (r.remaining >= 0 ? `Quedan ${fmt(r.remaining)}` : <span className="neg">Te has pasado {fmt(-r.remaining)}</span>) : 'Gasto sin presupuesto asignado'),
    empty: 'Pon un límite a cada categoría de gasto.',
  },
  {
    type: 'investment', title: 'Inversión', goal: true,
    planned: 'Objetivo', actual: 'Aportado',
    left: (r, fmt) => (r.remaining > 0 ? `Faltan por aportar ${fmt(r.remaining)}` : r.limit > 0 ? 'Objetivo cumplido ✓' : 'Aportación no planificada'),
    empty: 'Decide cuánto quieres invertir este mes y en qué.',
  },
];

export default function Presupuestos() {
  const { state, update } = useStore();
  const [month, setMonth] = useState(monthOf(todayISO()));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const cur = state.settings.currency;
  const fmt = (v) => money(v, cur);
  const st = budgetStatus(state, month);
  const hasOwn = !!state.budgets[month];
  const { income: inc, expense: exp, investment: inv } = st.sections;

  // Días transcurridos del mes → ritmo de gasto
  const isCurrent = month === monthOf(todayISO());
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const elapsed = isCurrent ? new Date().getDate() / days : month < monthOf(todayISO()) ? 1 : 0;

  function startEdit() {
    const b = budgetFor(state, month);
    setDraft(Object.fromEntries(state.categories.map((c) => [c.id, b[c.id] ? String(b[c.id]).replace('.', ',') : ''])));
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

  /** Rellena con los fijos del mes: nómina (con paga extra si toca), recibos y aportaciones periódicas. */
  function fillFromFixed() {
    const sums = {};
    state.recurring.filter((r) => r.active).forEach((r) => {
      sums[r.categoryId] = (sums[r.categoryId] || 0) + expectedInMonth(r, month);
    });
    const next = { ...draft };
    for (const [id, v] of Object.entries(sums)) {
      if (!(parseAmount(next[id]) > 0)) next[id] = String(Math.round(v * 100) / 100).replace('.', ',');
    }
    setDraft(next);
  }

  const draftSum = (type) => state.categories.filter((c) => c.type === type).reduce((s, c) => s + (parseAmount(draft[c.id]) || 0), 0);
  const draftFree = draftSum('income') - draftSum('expense') - draftSum('investment');

  return (
    <>
      <div className="page-head">
        <div><h1>Presupuestos</h1><div className="sub">Planifica ingresos, gastos e inversión de cada mes</div></div>
        <MonthPicker month={month} setMonth={setMonth} />
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label="Ingresos previstos" value={fmt(inc.planned)} delta={`Recibido ${fmt(inc.actual)}`} />
        <Stat label="Gastos presupuestados" value={fmt(exp.planned)}
          delta={`Gastado ${fmt(exp.actual)}${exp.planned > 0 ? ` · ${Math.round((exp.actual / exp.planned) * 100)}%` : ''}`}
          deltaClass={exp.planned > 0 && exp.actual > exp.planned ? 'neg' : ''} />
        <Stat label="Inversión planificada" value={fmt(inv.planned)} delta={`Aportado ${fmt(inv.actual)}`} />
        <Stat label="Sin asignar" value={fmt(st.unassigned)} deltaClass={st.unassigned < 0 ? 'neg' : ''}
          delta={st.unassigned < 0 ? 'Planificas más de lo que ingresas' : st.unassigned > 0 ? 'Asígnalo a gasto, ahorro o inversión' : 'Cada euro tiene un destino ✓'} />
      </div>

      {!editing ? (
        <div className="grid g3">
          <div className="card span2 budget-toolbar" style={{ gridColumn: '1 / -1', padding: '12px 16px' }}>
            <div className="row wrap">
              <span className="small muted">
                {fmt(inc.planned)} ingresos − {fmt(exp.planned)} gastos − {fmt(inv.planned)} inversión = <b className={st.unassigned < 0 ? 'neg' : ''}>{fmt(st.unassigned)}</b> sin asignar
              </span>
              <span className="spacer" />
              {!hasOwn && Object.keys(state.budgetTemplate).length > 0 && <span className="badge">Usando plantilla</span>}
              <button className="btn sm" onClick={copyPrev}>Copiar mes anterior</button>
              <button className="btn sm primary" onClick={startEdit}>Editar presupuesto</button>
            </div>
          </div>
          {BLOCKS.map((b) => {
            const sec = st.sections[b.type];
            return (
              <div className="card" key={b.type}>
                <div className="card-head">
                  <h2>{b.title}</h2>
                  <span className="tnum small"><b>{fmt(sec.actual)}</b><span className="muted"> / {fmt(sec.planned)}</span></span>
                </div>
                {sec.rows.length === 0 ? <Empty>{b.empty}</Empty> : (
                  <div className="stack">
                    {sec.rows.map((r) => (
                      <div key={r.category.id}>
                        <div className="row" style={{ marginBottom: 6 }}>
                          <CategoryIcon cat={r.category} size={28} />
                          <span style={{ fontWeight: 500 }}>{r.category.name}</span>
                          <span className="spacer" />
                          <span className="tnum small">
                            <b>{fmt(r.spent)}</b>
                            <span className="muted"> / {r.limit > 0 ? fmt(r.limit) : '—'}</span>
                          </span>
                        </div>
                        <Progress goal={b.goal} ratio={r.limit > 0 ? r.ratio : r.spent > 0 ? (b.goal ? 1 : 1.01) : 0}
                          mark={!b.goal && r.limit > 0 && elapsed > 0 && elapsed < 1 ? elapsed : null} />
                        <div className="small muted" style={{ marginTop: 4 }}>{b.left(r, fmt)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {elapsed > 0 && elapsed < 1 && <p className="small muted" style={{ gridColumn: '1 / -1', margin: 0 }}>En gastos, la marca vertical indica cuánto del mes ha pasado: si la barra la supera, vas por encima del ritmo.</p>}
        </div>
      ) : (
        <div className="card">
          <div className="card-head">
            <h2>Editar presupuesto</h2>
            <button className="btn sm" onClick={fillFromFixed}>Rellenar con mis fijos</button>
          </div>
          {BLOCKS.map((b) => (
            <div className="budget-block" key={b.type}>
              <h3 style={{ marginBottom: 10 }}>{b.title} · {fmt(draftSum(b.type))}</h3>
              <div className="form-grid">
                {state.categories.filter((c) => c.type === b.type).map((c) => (
                  <label className="field" key={c.id}>
                    <span className="row"><CategoryIcon cat={c} size={22} />{c.name}</span>
                    <input className="input" inputMode="decimal" placeholder="0" value={draft[c.id] || ''}
                      onChange={(e) => setDraft({ ...draft, [c.id]: e.target.value })} />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="alert info" style={{ marginTop: 18 }}>
            <span>
              {fmt(draftSum('income'))} − {fmt(draftSum('expense'))} − {fmt(draftSum('investment'))} = <b>{fmt(draftFree)}</b> sin asignar.
              {draftFree < 0 ? ' Estás planificando más de lo que ingresas.' : draftFree > 0 ? ' Puedes asignarlo a gastos o inversión.' : ' Cada euro tiene un destino.'}
            </span>
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setEditing(false)}>Cancelar</button>
            <button className="btn" onClick={() => saveDraft(false)}>Guardar solo este mes</button>
            <button className="btn primary" onClick={() => saveDraft(true)}>Guardar y usar como plantilla</button>
          </div>
          <p className="small muted">La plantilla se aplica automáticamente a los meses que no tengan presupuesto propio. "Rellenar con mis fijos" añade tu nómina (con la paga extra si toca este mes), recibos y aportaciones periódicas.</p>
        </div>
      )}
    </>
  );
}
