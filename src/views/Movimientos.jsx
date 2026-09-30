import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { monthOf, monthTotals, shiftMonth, todayISO } from '../lib/finance.js';
import { dateLabel, money, monthLabel } from '../lib/format.js';
import { Empty, Seg, Stat } from '../components/ui.jsx';
import QuickAdd from './QuickAdd.jsx';

export function MonthPicker({ month, setMonth }) {
  return (
    <div className="row">
      <button className="btn sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mes anterior">‹</button>
      <strong style={{ minWidth: 130, textAlign: 'center' }}>{monthLabel(month)}</strong>
      <button className="btn sm" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mes siguiente">›</button>
    </div>
  );
}

export function TxItem({ t, cat, cur, onClick }) {
  return (
    <div className="list-item" style={{ cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
      <div className="ico">{cat?.icon || '•'}</div>
      <div className="main">
        <div className="title">{t.note || cat?.name || 'Sin concepto'}</div>
        <div className="meta">{cat?.name}{t.recurringId ? ' · fijo' : ''}</div>
      </div>
      <div className={`amt ${t.type === 'income' ? 'pos' : ''}`}>
        {t.type === 'income' ? '+' : '−'}{money(t.amount, cur)}
      </div>
    </div>
  );
}

export default function Movimientos() {
  const { state } = useStore();
  const [month, setMonth] = useState(monthOf(todayISO()));
  const [filter, setFilter] = useState('all');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const cur = state.settings.currency;
  const catById = useMemo(() => Object.fromEntries(state.categories.map((c) => [c.id, c])), [state.categories]);

  const txs = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return state.transactions
      .filter((t) => monthOf(t.date) === month)
      .filter((t) => filter === 'all' || t.type === filter)
      .filter((t) => !cat || t.categoryId === cat)
      .filter((t) => !ql || (t.note || '').toLowerCase().includes(ql) || (catById[t.categoryId]?.name || '').toLowerCase().includes(ql))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [state.transactions, month, filter, cat, q, catById]);

  const totals = monthTotals(state.transactions, month);
  const byDay = useMemo(() => {
    const m = new Map();
    txs.forEach((t) => { if (!m.has(t.date)) m.set(t.date, []); m.get(t.date).push(t); });
    return [...m.entries()];
  }, [txs]);

  function exportCsv() {
    const rows = [['Fecha', 'Tipo', 'Categoría', 'Concepto', 'Importe']];
    txs.forEach((t) => rows.push([t.date, t.type === 'income' ? 'Ingreso' : 'Gasto', catById[t.categoryId]?.name || '', t.note || '', String(t.amount).replace('.', ',')]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = `movimientos-${month}.csv`;
    a.click();
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Movimientos</h1><div className="sub">Tus gastos e ingresos del día a día</div></div>
        <MonthPicker month={month} setMonth={setMonth} />
      </div>

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <Stat label="Ingresos" value={money(totals.income, cur)} deltaClass="pos" />
        <Stat label="Gastos" value={money(totals.expense, cur)} />
        <Stat label="Ahorro" value={money(totals.balance, cur)}
          delta={totals.income > 0 ? `${Math.round((totals.balance / totals.income) * 100)}% de tus ingresos` : null}
          deltaClass={totals.balance >= 0 ? 'pos' : 'neg'} />
      </div>

      <div className="card">
        <div className="row wrap" style={{ marginBottom: 8 }}>
          <Seg value={filter} onChange={setFilter} options={[
            { value: 'all', label: 'Todos' }, { value: 'expense', label: 'Gastos' }, { value: 'income', label: 'Ingresos' },
          ]} />
          <select className="input" style={{ width: 180 }} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas las categorías</option>
            {state.categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <input className="input" style={{ width: 180 }} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="spacer" />
          <button className="btn sm" onClick={exportCsv} disabled={!txs.length}>Exportar CSV</button>
        </div>
        {byDay.length === 0 && <Empty>No hay movimientos este mes. Pulsa <b>+</b> para añadir uno.</Empty>}
        {byDay.map(([day, list]) => (
          <div key={day}>
            <div className="day-head">{dateLabel(day)}</div>
            <div className="list">
              {list.map((t) => <TxItem key={t.id} t={t} cat={catById[t.categoryId]} cur={cur} onClick={() => setEditing(t)} />)}
            </div>
          </div>
        ))}
      </div>
      {editing && <QuickAdd editing={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
