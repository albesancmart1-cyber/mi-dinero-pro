import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../lib/store.jsx';
import { uid } from '../../lib/defaults.js';
import { budgetVerdict, effectiveValue, monthsOfYear, removeBudgetCat, setBudgetCell, setBudgetCells } from '../../lib/budget.js';
import { monthOf, shiftMonth, todayISO } from '../../lib/finance.js';
import { monthLabel, num, parseAmount } from '../../lib/format.js';
import { CategoryIcon, Icon } from '../../components/icons.jsx';
import { Modal, Seg } from '../../components/ui.jsx';
import { TYPES } from './Tracking.jsx';

const MON = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DEFAULT_ICON = { income: 'banknote', expense: 'box', investment: 'pie' };
const r2 = (x) => Math.round(x * 100) / 100;

const toText = (v) => (v ? String(v).replace('.', ',') : '');
const show = (v) => (v == null ? '' : v === 0 ? '–' : `${v < 0 ? '−' : ''}${num(Math.abs(v), 2)}`);

/** Celda editable: muestra el valor "en vivo" y solo guarda lo que escribes al salir. */
function Cell({ value, tone, cat, month, row, col, onCommit }) {
  const [text, setText] = useState(null); // null = no se está editando
  const shown = toText(value);
  const commit = () => {
    if (text == null) return;
    const t = text.trim();
    const v = t === '' ? 0 : parseAmount(t);
    setText(null);
    if (!Number.isNaN(v) && r2(v) !== r2(value)) onCommit(cat, month, v);
  };
  return (
    <input
      className={`cell-in ${tone}`} inputMode="decimal" autoComplete="off" spellCheck={false}
      data-row={row} data-col={col} data-cat={cat} aria-label={`${cat} ${month}`}
      value={text ?? shown}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setText(e.target.value.replace(/[^0-9.,\-]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        const go = (dr, dc) => {
          e.preventDefault();
          e.target.closest('.sheet-wrap')?.querySelector(`[data-row="${row + dr}"][data-col="${col + dc}"]`)?.focus();
        };
        if (e.key === 'Enter' || e.key === 'ArrowDown') go(1, 0);
        else if (e.key === 'ArrowUp') go(-1, 0);
        else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0 && e.target.selectionEnd === e.target.value.length) go(0, -1);
        else if (e.key === 'ArrowRight' && e.target.selectionStart === 0 && e.target.selectionEnd === e.target.value.length) go(0, 1);
        else if (e.key === 'Escape') { setText(null); e.target.blur(); }
      }}
    />
  );
}

/** Ventana para elegir qué categorías aparecen en el presupuesto. */
function AddCategory({ type, title, onAdd, onClose }) {
  const { state, update } = useStore();
  const [name, setName] = useState('');
  const inList = new Set(state.budgetCats || []);
  const available = state.categories.filter((c) => c.type === type);

  function create() {
    const n = name.trim();
    if (!n) return;
    const id = `c-${uid()}`;
    update((s) => ({
      ...s,
      categories: [...s.categories, { id, name: n, type, icon: DEFAULT_ICON[type] }],
      budgetCats: [...(s.budgetCats || []), id],
    }));
    onAdd(id);
    setName('');
  }

  return (
    <Modal title={`Añadir a ${title.toLowerCase()}`} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Listo</button>}>
      <p className="small muted" style={{ marginTop: 0 }}>Toca las categorías que quieras controlar. Aparecerán como una fila nueva en la hoja.</p>
      <div className="chips">
        {available.map((c) => (
          <button type="button" key={c.id} className={`chip chip-logo${inList.has(c.id) ? ' on' : ''}`} disabled={inList.has(c.id)}
            onClick={() => { update((s) => ({ ...s, budgetCats: [...(s.budgetCats || []), c.id] })); onAdd(c.id); }}>
            <CategoryIcon cat={c} size={22} />{c.name}{inList.has(c.id) && ' ✓'}
          </button>
        ))}
      </div>
      <form className="row" style={{ marginTop: 16 }} onSubmit={(e) => { e.preventDefault(); create(); }}>
        <input className="input" placeholder="Crear categoría nueva…" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={!name.trim()}>Crear</button>
      </form>
    </Modal>
  );
}

/** Presupuesto anual en formato hoja de cálculo. */
export default function BudgetGrid({ initialYear, onClose, onCopy }) {
  const { state, update } = useStore();
  const [year, setYear] = useState(Number(initialYear));
  const [view, setView] = useState('budget'); // budget | real | diff
  const [adding, setAdding] = useState(null); // tipo cuya ventana de categorías está abierta
  const [focusCat, setFocusCat] = useState(null);
  const wrapRef = useRef(null);
  const thisMonth = monthOf(todayISO());
  const months = monthsOfYear(year);
  const catById = useMemo(() => Object.fromEntries(state.categories.map((c) => [c.id, c])), [state.categories]);
  const editable = view === 'budget';

  const budgetVal = (cat, m) => effectiveValue(state.budgets, cat, m, state.budgetTemplate);

  // Real: gasto/ingreso/aportación por categoría y mes del año
  const real = useMemo(() => {
    const out = {};
    for (const t of state.transactions) {
      const m = t.date.slice(0, 7);
      if (!m.startsWith(`${year}-`)) continue;
      out[m] ||= {};
      out[m][t.categoryId] = (out[m][t.categoryId] || 0) + (Number(t.amount) || 0);
    }
    return out;
  }, [state.transactions, year]);
  const realVal = (cat, m) => real[m]?.[cat] || 0;

  // Filas por bloque. En Real/Diferencia se añaden las categorías con movimientos que no están presupuestadas.
  const sections = TYPES.map((t) => {
    const rows = (state.budgetCats || []).map((id) => catById[id]).filter((c) => c && c.type === t.type);
    let extra = [];
    if (!editable) {
      const inList = new Set(rows.map((c) => c.id));
      const seen = new Set();
      for (const m of months) for (const id of Object.keys(real[m] || {})) {
        const c = catById[id];
        if (c && c.type === t.type && !inList.has(id) && !seen.has(id) && real[m][id] > 0) { seen.add(id); extra.push(c); }
      }
    }
    return { ...t, rows, extra };
  });
  let rowCounter = 0;
  const rowIndex = {};
  sections.forEach((s) => s.rows.forEach((c) => { rowIndex[c.id] = rowCounter++; }));

  const future = (m) => m > thisMonth;
  const valueOf = (cat, m) => {
    if (view === 'budget') return budgetVal(cat, m);
    if (future(m)) return null;
    return view === 'real' ? realVal(cat, m) : r2(realVal(cat, m) - budgetVal(cat, m));
  };
  const sumOver = (cats, m) => {
    const vals = cats.map((c) => valueOf(c.id, m));
    return vals.every((v) => v == null) ? null : r2(vals.reduce((s, v) => s + (v || 0), 0));
  };
  // Estado de color de una celda (real / diferencia)
  const toneOf = (type, bud, rl, m) => (future(m) ? '' : budgetVerdict(type, bud, rl, m < thisMonth).tone);

  const commit = (cat, month, v) => update((s) => ({ ...s, budgets: setBudgetCell(s.budgets, cat, month, v, s.budgetTemplate) }));

  // Pegar un bloque copiado de Excel: filas con tabuladores
  function onPaste(e) {
    const el = e.target;
    if (!editable || el.dataset?.row == null) return;
    const text = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(text.trim())) return; // un solo valor: pegado normal
    e.preventDefault();
    const flat = sections.flatMap((s) => s.rows);
    const r0 = Number(el.dataset.row), c0 = Number(el.dataset.col);
    const edits = [];
    text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').forEach((line, dr) => {
      line.split('\t').forEach((cell, dc) => {
        const cat = flat[r0 + dr]?.id, month = months[c0 + dc];
        if (!cat || !month) return;
        const t = cell.trim().replace(/[€\s]/g, '');
        const v = t === '' ? 0 : parseAmount(t);
        if (!Number.isNaN(v)) edits.push({ cat, month, value: v });
      });
    });
    if (edits.length) update((s) => ({ ...s, budgets: setBudgetCells(s.budgets, edits, s.budgetTemplate) }));
  }

  function removeRow(c) {
    if (!confirm(`¿Quitar "${c.name}" del presupuesto? Se borrarán sus importes de todos los meses (la categoría y tus movimientos se mantienen).`)) return;
    update((s) => ({ ...s, budgetCats: (s.budgetCats || []).filter((x) => x !== c.id), budgets: removeBudgetCat(s.budgets, c.id) }));
  }

  // Al abrir (o cambiar de año) la hoja se desplaza para que el mes actual quede a la vista
  useEffect(() => {
    const wrap = wrapRef.current;
    const th = wrap?.querySelector('th.now');
    if (!wrap) return;
    wrap.scrollLeft = th ? Math.max(0, th.offsetLeft - wrap.clientWidth / 2 + th.offsetWidth / 2) : 0;
  }, [year]);

  // Al añadir una categoría, el cursor va a su celda del mes actual
  useEffect(() => {
    if (!focusCat || adding) return; // espera a que se cierre la ventana de categorías
    const col = months.includes(thisMonth) ? months.indexOf(thisMonth) : 0;
    const el = wrapRef.current?.querySelector(`[data-cat="${focusCat}"][data-col="${col}"]`);
    if (el) { el.focus(); setFocusCat(null); }
  });

  const sectionCells = (s) => months.map((m) => sumOver([...s.rows, ...s.extra], m));
  const secTotals = Object.fromEntries(sections.map((s) => [s.type, sectionCells(s)]));
  const sumRow = (arr) => { const v = arr.filter((x) => x != null); return v.length ? r2(v.reduce((a, b) => a + b, 0)) : null; };
  const freeCells = months.map((m, i) => {
    const [a, b, c] = ['income', 'expense', 'investment'].map((t) => secTotals[t][i]);
    return a == null && b == null && c == null ? null : r2((a || 0) - (b || 0) - (c || 0));
  });

  const hasRows = sections.some((s) => s.rows.length || s.extra.length);
  const colIndexNow = months.indexOf(thisMonth);

  return (
    <>
      <div className="page-head">
        <div><h1>Presupuesto anual</h1><div className="sub">Una hoja con todos los meses: lo que escribas se guarda al instante</div></div>
        <div className="row wrap">
          <button className="btn" onClick={() => onCopy(months.includes(thisMonth) ? thisMonth : months[0])}><Icon name="copy" size={16} />Copiar mes…</button>
          <button className="btn primary" onClick={onClose}>Listo</button>
        </div>
      </div>

      <div className="card sheet-card">
        <div className="row wrap" style={{ marginBottom: 12 }}>
          <button className="btn sm" onClick={() => setYear(year - 1)} aria-label="Año anterior">‹</button>
          <strong className="tnum" style={{ minWidth: 48, textAlign: 'center' }}>{year}</strong>
          <button className="btn sm" onClick={() => setYear(year + 1)} aria-label="Año siguiente">›</button>
          <span className="spacer" />
          <Seg value={view} onChange={setView} options={[
            { value: 'budget', label: 'Presupuesto' }, { value: 'real', label: 'Real' }, { value: 'diff', label: 'Diferencia' },
          ]} />
        </div>

        <div className="sheet-wrap" ref={wrapRef} onPaste={onPaste}>
          <table className="sheet">
            <thead>
              <tr>
                <th className="sticky corner">Categoría</th>
                {months.map((m, i) => (
                  <th key={m} className={m === thisMonth ? 'now' : ''}>
                    <span>{MON[i]}</span>
                    <button className="th-copy" title={`Copiar ${monthLabel(m)}…`} aria-label={`Copiar ${monthLabel(m)}`} onClick={() => onCopy(m)}><Icon name="copy" size={13} /></button>
                  </th>
                ))}
                <th className="total">{view === 'diff' ? 'Dif. año' : 'Total año'}</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => renderSection(s))}
              {hasRows && (
                <tr className="free-row">
                  <td className="sticky" title="Ingresos − gastos − inversión">{view === 'budget' ? 'Sin asignar' : view === 'real' ? 'Sobrante real' : 'Dif. sobrante'}</td>
                  {freeCells.map((v, i) => <td key={i} className={`num${v != null && v < 0 && view !== 'diff' ? ' v-bad' : ''}`}>{show(v)}</td>)}
                  <td className="num total">{show(sumRow(freeCells))}</td>
                </tr>
              )}
            </tbody>
          </table>
          {!hasRows && (
            <div className="empty" style={{ paddingTop: 8 }}>
              Tu presupuesto está vacío. Pulsa <b>+ Añadir categoría</b> en Ingresos, Gastos o Inversión y escribe un importe en el mes que quieras.
            </div>
          )}
        </div>

        {editable ? (
          <p className="small muted" style={{ margin: '12px 0 0' }}>
            Escribe un importe en un mes y se aplica también a los siguientes, hasta el próximo mes que hayas cambiado.
            Las cifras en <span className="same-demo">gris</span> se heredan del mes anterior; las <b>en negrita</b> son las que has cambiado.
            Puedes usar las flechas, Intro y Tab como en Excel, y pegar un bloque copiado desde Excel.
          </p>
        ) : (
          <p className="small muted" style={{ margin: '12px 0 0' }}>
            {view === 'real' ? 'Lo que has registrado en cada mes. ' : 'Diferencia = real − presupuestado. '}
            <span className="v-ok"><b>Verde</b></span>: gastos por debajo de lo presupuestado, o ingresos/inversión que llegan al objetivo.{' '}
            <span className="v-warn"><b>Ámbar</b></span>: gasto cerca del límite o objetivo aún pendiente.{' '}
            <span className="v-bad"><b>Rojo</b></span>: gasto por encima del presupuesto u objetivo no alcanzado en un mes ya cerrado. Los meses futuros se dejan en blanco.
          </p>
        )}
      </div>

      {adding && (
        <AddCategory type={adding} title={TYPES.find((t) => t.type === adding).title}
          onAdd={(id) => setFocusCat(id)} onClose={() => setAdding(null)} />
      )}
    </>
  );

  // Función (no componente): así las celdas no se recrean en cada cambio y el cursor no se pierde
  function renderSection(s) {
    const cells = secTotals[s.type];
    const allRows = [...s.rows, ...s.extra];
    return (
      <Fragment key={s.type}>
        <tr className="sec-head">
          <td className="sticky"><span className={`dot ${s.type}`} />{s.title}</td>
          {cells.map((v, i) => {
            // En Real/Diferencia el total del bloque se colorea con su estado
            let tone = '';
            if (!editable && v != null) {
              const bud = budgetSum(s, months[i]);
              tone = view === 'real' ? toneOf(s.type, bud, v, months[i]) : toneOf(s.type, bud, bud + v, months[i]);
            }
            return <td key={i} className={`num ${tone && `v-${tone}`}`}>{show(v)}</td>;
          })}
          <td className="num total">{show(sumRow(cells))}</td>
        </tr>
        {allRows.map((c) => {
          const isExtra = !s.rows.includes(c);
          const total = (() => {
            let t = 0, any = false;
            for (const m of months) { const v = valueOf(c.id, m); if (v != null) { t += v; any = true; } }
            return any ? r2(t) : null;
          })();
          return (
            <tr key={c.id} className={isExtra ? 'extra-row' : ''}>
              <td className="sticky">
                <div className="row">
                  <CategoryIcon cat={c} size={24} />
                  <span className="cat-name">{c.name}</span>
                  {isExtra && <span className="badge">sin presupuestar</span>}
                  {editable && !isExtra && <button className="row-x" title="Quitar del presupuesto" aria-label={`Quitar ${c.name}`} onClick={() => removeRow(c)}>✕</button>}
                </div>
              </td>
              {months.map((m, i) => {
                const v = valueOf(c.id, m);
                if (editable) {
                  const prev = budgetVal(c.id, shiftMonth(m, -1));
                  return (
                    <td key={m} className={`cell${m === thisMonth ? ' now' : ''}`}>
                      <Cell value={v} cat={c.id} month={m} row={rowIndex[c.id]} col={i}
                        tone={v === prev ? 'same' : 'changed'} onCommit={commit} />
                    </td>
                  );
                }
                const bud = budgetVal(c.id, m), rl = realVal(c.id, m);
                const tone = v == null ? '' : toneOf(s.type, bud, rl, m);
                const sign = view === 'diff' && v ? (v > 0 ? '+' : '−') : '';
                return (
                  <td key={m} className={`num ro${m === thisMonth ? ' now' : ''}${tone ? ` v-${tone} tint` : ''}`}>
                    {v == null ? '' : v === 0 ? '–' : view === 'diff' ? `${sign}${num(Math.abs(v), 2)}` : num(v, 2)}
                  </td>
                );
              })}
              <td className="num total">{show(total)}</td>
            </tr>
          );
        })}
        {editable && (
          <tr className="add-row">
            <td className="sticky"><button className="add-cat" onClick={() => setAdding(s.type)}>+ Añadir<span className="hide-sm"> categoría</span></button></td>
            <td colSpan={13} />
          </tr>
        )}
      </Fragment>
    );
  }

  // Suma presupuestada del bloque en un mes (para colorear el total del bloque)
  function budgetSum(s, m) {
    return r2([...s.rows, ...s.extra].reduce((a, c) => a + budgetVal(c.id, m), 0));
  }
}
