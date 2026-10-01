import { useStore } from '../../lib/store.jsx';
import { budgetStatus, monthOf, todayISO } from '../../lib/finance.js';
import { budgetVerdict } from '../../lib/budget.js';
import { money } from '../../lib/format.js';
import { CategoryIcon } from '../../components/icons.jsx';
import { Empty, Progress } from '../../components/ui.jsx';
import { MonthPicker } from '../Movimientos.jsx';

export const TYPES = [
  { type: 'income', title: 'Ingresos', plan: 'Previsto', real: 'Recibido' },
  { type: 'expense', title: 'Gastos', plan: 'Presupuestado', real: 'Gastado' },
  { type: 'investment', title: 'Inversión', plan: 'Objetivo', real: 'Aportado' },
];

/** Etiqueta de estado: texto + símbolo + color (nunca solo color). */
export function Verdict({ v }) {
  if (!v?.label) return null;
  const sym = v.tone === 'ok' ? '✓' : v.tone === 'warn' ? '!' : v.relation === 'above' ? '▲' : '▼';
  return <span className={`vchip ${v.tone}`}><i aria-hidden="true">{sym}</i>{v.label}</span>;
}

/** Diferencia con signo y en palabras: "+36 € por encima". */
function Diff({ v, fmt }) {
  if (v.diff === 0 && !v.label) return <span className="muted">—</span>;
  const rel = v.relation === 'above' ? 'por encima' : v.relation === 'below' ? 'por debajo' : 'justo';
  return (
    <span className={`vtext ${v.tone}`}>
      {v.diff > 0 ? '+' : v.diff < 0 ? '−' : ''}{fmt(Math.abs(v.diff))}
      <small> {rel}</small>
    </span>
  );
}

function ExpenseBanner({ sec, isCurrent, elapsed, fmt, onEdit }) {
  if (sec.planned <= 0) {
    return (
      <div className="alert info">
        <span>Aún no has presupuestado gastos para este mes.</span>
        <span className="spacer" />
        <button className="btn sm" onClick={onEdit}>Crear presupuesto</button>
      </div>
    );
  }
  const v = budgetVerdict('expense', sec.planned, sec.actual);
  const used = sec.actual / sec.planned;
  const text = v.state === 'over'
    ? <>Vas <b>por encima</b> del presupuesto de gastos: {fmt(sec.actual)} gastados de {fmt(sec.planned)} (<b>+{fmt(v.diff)}</b>).</>
    : v.state === 'near'
      ? <>Estás <b>al límite</b> del presupuesto de gastos: llevas el {Math.round(used * 100)} % y te quedan {fmt(sec.remaining)}.</>
      : <>Vas <b>por debajo</b> del presupuesto de gastos: {fmt(sec.actual)} de {fmt(sec.planned)} ({Math.round(used * 100)} %), te quedan {fmt(sec.remaining)}.</>;
  const fast = isCurrent && elapsed > 0 && elapsed < 1 && used > elapsed + 0.1;
  return (
    <div className={`alert verdict ${v.tone}`}>
      <Verdict v={v} />
      <span style={{ flex: 1 }}>
        {text}
        {isCurrent && elapsed > 0 && elapsed < 1 && (
          <small className="muted" style={{ display: 'block' }}>
            Ha pasado el {Math.round(elapsed * 100)} % del mes y llevas gastado el {Math.round(used * 100)} % del presupuesto{fast ? ': vas más rápido que el mes' : ''}.
          </small>
        )}
      </span>
    </div>
  );
}

/** Presupuestado frente a real de un mes, con el estado de cada línea. */
export default function Tracking({ month, setMonth, onEdit, onCopy }) {
  const { state } = useStore();
  const cur = state.settings.currency;
  const fmt = (x) => money(x, cur);
  const st = budgetStatus(state, month);
  const thisMonth = monthOf(todayISO());
  const closed = month < thisMonth;
  const isCurrent = month === thisMonth;
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const elapsed = isCurrent ? new Date().getDate() / days : closed ? 1 : 0;
  const { income: inc, expense: exp, investment: inv } = st.sections;
  const isEmpty = TYPES.every((t) => st.sections[t.type].rows.length === 0);

  return (
    <>
      <div className="page-head">
        <div><h1>Presupuestos</h1><div className="sub">Cómo vas frente a lo que has planificado</div></div>
        <div className="row wrap">
          <MonthPicker month={month} setMonth={setMonth} />
          <button className="btn" onClick={() => onCopy(month)}>Copiar mes…</button>
          <button className="btn primary" onClick={onEdit}>Editar presupuesto</button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <ExpenseBanner sec={exp} isCurrent={isCurrent} elapsed={elapsed} fmt={fmt} onEdit={onEdit} />
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        {TYPES.map(({ type, title, plan, real }) => {
          const sec = st.sections[type];
          const v = budgetVerdict(type, sec.planned, sec.actual, closed);
          return (
            <div className="card stat" key={type}>
              <div className="label">{title}</div>
              <div className="value tnum">{fmt(sec.actual)}</div>
              <div className="delta">{real} · {plan.toLowerCase()} {fmt(sec.planned)}</div>
              <div style={{ marginTop: 8 }}><Verdict v={v} /></div>
            </div>
          );
        })}
        <div className="card stat">
          <div className="label">Sin asignar</div>
          <div className={`value tnum ${st.unassigned < 0 ? 'neg' : ''}`}>{fmt(st.unassigned)}</div>
          <div className="delta">
            {st.unassigned < 0 ? 'Planificas más de lo que ingresas' : st.unassigned > 0 ? 'Asígnalo a gasto, ahorro o inversión' : 'Cada euro tiene un destino ✓'}
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="card">
          <Empty>
            Aún no hay presupuesto. Pulsa <b>Editar presupuesto</b> para abrir la hoja anual y añadir las categorías que quieras controlar.
          </Empty>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="tbl track">
              <thead>
                <tr>
                  <th>Categoría</th><th className="num">Presupuestado</th><th className="num">Real</th>
                  <th className="num">Diferencia</th><th>Estado</th>
                </tr>
              </thead>
              {TYPES.map(({ type, title }) => {
                const sec = st.sections[type];
                if (!sec.rows.length) return null;
                const goal = type !== 'expense';
                const tv = budgetVerdict(type, sec.planned, sec.actual, closed);
                return (
                  <tbody key={type}>
                    <tr className="sec-row"><td colSpan={5}>{title}</td></tr>
                    {sec.rows.map((r) => {
                      const v = budgetVerdict(type, r.limit, r.spent, closed);
                      return (
                        <tr key={r.category.id} className={v.state === 'over' || v.state === 'short' ? 'row-bad' : ''}>
                          <td>
                            <div className="row"><CategoryIcon cat={r.category} size={28} />
                              <div style={{ minWidth: 150 }}>
                                <div className="name">{r.category.name}</div>
                                <Progress goal={goal} ratio={r.limit > 0 ? r.spent / r.limit : r.spent > 0 ? (goal ? 1 : 1.01) : 0}
                                  mark={!goal && r.limit > 0 && elapsed > 0 && elapsed < 1 ? elapsed : null} />
                              </div>
                            </div>
                          </td>
                          <td className="num">{r.limit > 0 ? fmt(r.limit) : <span className="muted">—</span>}</td>
                          <td className="num"><b>{fmt(r.spent)}</b></td>
                          <td className="num"><Diff v={v} fmt={fmt} /></td>
                          <td><Verdict v={v} /></td>
                        </tr>
                      );
                    })}
                    <tr className="tot-row">
                      <td>Total {title.toLowerCase()}</td>
                      <td className="num">{fmt(sec.planned)}</td>
                      <td className="num">{fmt(sec.actual)}</td>
                      <td className="num"><Diff v={tv} fmt={fmt} /></td>
                      <td><Verdict v={tv} /></td>
                    </tr>
                  </tbody>
                );
              })}
            </table>
          </div>
          <p className="small muted" style={{ margin: '12px 0 0' }}>
            <b>Diferencia</b> = real − presupuestado. En gastos, <b>por debajo</b> es lo que quieres; en ingresos e inversión, lo que quieres es llegar al objetivo.
            {isCurrent && elapsed > 0 && elapsed < 1 && ' La marca vertical de cada barra de gasto indica cuánto del mes ha pasado.'}
          </p>
        </div>
      )}
    </>
  );
}
