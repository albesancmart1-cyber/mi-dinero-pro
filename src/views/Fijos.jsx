import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { uid } from '../lib/defaults.js';
import { FREQUENCIES, monthlyEquivalent, subscriptionAlerts, todayISO } from '../lib/finance.js';
import { dateLabel, money, parseAmount } from '../lib/format.js';
import { Empty, Field, Modal, Seg, Stat } from '../components/ui.jsx';

function RecurringForm({ item, onClose, preset }) {
  const { state, update } = useStore();
  const [f, setF] = useState(() => item ? { ...item, amount: String(item.amount).replace('.', ',') } : {
    name: '',
    type: preset === 'income' ? 'income' : 'expense',
    amount: '',
    frequency: 'monthly',
    categoryId: preset === 'sub' ? 'c-subs' : preset === 'income' ? 'c-nomina' : '',
    nextDate: todayISO(),
    isSubscription: preset === 'sub',
    startDate: todayISO(),
    cancelBy: '',
    autoPost: true,
    active: true,
    notes: '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });
  const cats = state.categories.filter((c) => c.type === f.type);
  const catId = cats.some((c) => c.id === f.categoryId) ? f.categoryId : cats[0]?.id;
  const amount = parseAmount(f.amount);
  const valid = f.name.trim() && amount > 0 && f.nextDate;

  function save() {
    const rec = { ...f, id: item?.id || uid(), amount: Math.round(amount * 100) / 100, categoryId: catId, name: f.name.trim(), anchorDay: Number(f.nextDate.slice(8, 10)) };
    update((s) => ({
      ...s,
      recurring: item ? s.recurring.map((r) => (r.id === item.id ? rec : r)) : [...s.recurring, rec],
    }));
    onClose();
  }
  function remove() {
    if (!confirm('¿Eliminar este fijo? Los movimientos ya generados se mantienen.')) return;
    update((s) => ({ ...s, recurring: s.recurring.filter((r) => r.id !== item.id) }));
    onClose();
  }

  return (
    <Modal title={item ? 'Editar' : f.isSubscription ? 'Nueva suscripción' : f.type === 'income' ? 'Nuevo ingreso fijo' : 'Nuevo gasto fijo'} onClose={onClose}
      footer={<>
        {item && <button className="btn danger" onClick={remove}>Eliminar</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!valid} onClick={save}>Guardar</button>
      </>}>
      <div className="stack">
        <Seg big value={f.type} onChange={(v) => setF({ ...f, type: v, isSubscription: v === 'income' ? false : f.isSubscription })} options={[
          { value: 'expense', label: 'Gasto', className: 'expense' }, { value: 'income', label: 'Ingreso', className: 'income' },
        ]} />
        <div className="form-grid">
          <Field label="Nombre" full><input className="input" autoFocus value={f.name} onChange={set('name')} placeholder={f.isSubscription ? 'Netflix, Spotify…' : f.type === 'income' ? 'Nómina' : 'Alquiler, luz…'} /></Field>
          <Field label="Importe"><input className="input" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0,00" /></Field>
          <Field label="Frecuencia">
            <select className="input" value={f.frequency} onChange={set('frequency')}>
              {Object.entries(FREQUENCIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Categoría">
            <select className="input" value={catId} onChange={set('categoryId')}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </Field>
          <Field label="Próximo cargo / cobro"><input type="date" className="input" value={f.nextDate} onChange={set('nextDate')} /></Field>
          {f.type === 'expense' && (
            <label className="check full"><input type="checkbox" checked={f.isSubscription} onChange={set('isSubscription')} /> Es una suscripción</label>
          )}
          {f.isSubscription && (
            <>
              <Field label="Fecha de alta"><input type="date" className="input" value={f.startDate || ''} onChange={set('startDate')} /></Field>
              <Field label="Recordarme cancelar antes de" hint="Ideal para periodos de prueba"><input type="date" className="input" value={f.cancelBy || ''} onChange={set('cancelBy')} /></Field>
            </>
          )}
          <Field label="Notas" full><input className="input" value={f.notes || ''} onChange={set('notes')} placeholder="Cómo darse de baja, cuenta asociada…" /></Field>
          <label className="check full"><input type="checkbox" checked={f.autoPost} onChange={set('autoPost')} /> Registrar el movimiento automáticamente cuando llegue la fecha</label>
        </div>
      </div>
    </Modal>
  );
}

function RecRow({ r, cat, cur, onEdit, onCancel }) {
  return (
    <div className="list-item">
      <div className="ico">{cat?.icon || '🔁'}</div>
      <div className="main" style={{ cursor: 'pointer' }} onClick={onEdit}>
        <div className="title">{r.name} {!r.active && <span className="badge">Cancelada</span>}</div>
        <div className="meta">
          {FREQUENCIES[r.frequency]?.label} · {r.active ? `próximo ${dateLabel(r.nextDate)}` : `cancelada ${r.cancelledAt ? dateLabel(r.cancelledAt) : ''}`}
          {r.isSubscription && r.startDate && ` · desde ${dateLabel(r.startDate)}`}
          {r.cancelBy && r.active && <> · <span className="neg">cancelar antes del {dateLabel(r.cancelBy)}</span></>}
        </div>
      </div>
      <div className="right">
        <div className={`amt ${r.type === 'income' ? 'pos' : ''}`}>{money(r.amount, cur)}</div>
        {r.frequency !== 'monthly' && <div className="meta">{money(monthlyEquivalent(r), cur)}/mes</div>}
      </div>
      {onCancel && r.active && <button className="btn sm" onClick={onCancel}>Dar de baja</button>}
    </div>
  );
}

export default function Fijos() {
  const { state, update } = useStore();
  const [form, setForm] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const cur = state.settings.currency;
  const catById = Object.fromEntries(state.categories.map((c) => [c.id, c]));
  const list = state.recurring.filter((r) => showInactive || r.active);
  const incomes = list.filter((r) => r.type === 'income');
  const expenses = list.filter((r) => r.type === 'expense' && !r.isSubscription);
  const subs = list.filter((r) => r.isSubscription);
  const active = state.recurring.filter((r) => r.active);
  const mIn = active.filter((r) => r.type === 'income').reduce((s, r) => s + monthlyEquivalent(r), 0);
  const mOut = active.filter((r) => r.type === 'expense').reduce((s, r) => s + monthlyEquivalent(r), 0);
  const mSubs = active.filter((r) => r.isSubscription).reduce((s, r) => s + monthlyEquivalent(r), 0);
  const alerts = subscriptionAlerts(state.recurring, todayISO(), 7);

  const cancel = (r) => {
    if (!confirm(`¿Marcar "${r.name}" como cancelada? Dejará de generar cargos.`)) return;
    update((s) => ({ ...s, recurring: s.recurring.map((x) => (x.id === r.id ? { ...x, active: false, cancelledAt: todayISO() } : x)) }));
  };

  const section = (title, items, preset, emptyText) => (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <button className="btn sm" onClick={() => setForm({ preset })}>+ Añadir</button>
      </div>
      {items.length === 0 ? <Empty>{emptyText}</Empty> : (
        <div className="list">
          {items.map((r) => (
            <RecRow key={r.id} r={r} cat={catById[r.categoryId]} cur={cur} onEdit={() => setForm({ item: r })}
              onCancel={r.isSubscription ? () => cancel(r) : null} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div><h1>Fijos y suscripciones</h1><div className="sub">Nómina, recibos y suscripciones que se registran solos</div></div>
        <label className="check small"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Mostrar canceladas</label>
      </div>

      {alerts.length > 0 && (
        <div className="stack" style={{ marginBottom: 16 }}>
          {alerts.map((r) => (
            <div key={r.id} className={`alert${r.overdue ? ' crit' : ''}`}>
              <span>⏰</span>
              <div style={{ flex: 1 }}>
                <b>{r.name}</b>: {r.overdue ? 'se te pasó la fecha para cancelarla' : 'recuerda cancelarla'} ({dateLabel(r.cancelBy)}) · {money(r.amount, cur)} {FREQUENCIES[r.frequency]?.label.toLowerCase()}
              </div>
              <button className="btn sm" onClick={() => cancel(r)}>Ya la he cancelado</button>
              <button className="btn sm ghost" onClick={() => update((s) => ({ ...s, recurring: s.recurring.map((x) => (x.id === r.id ? { ...x, cancelBy: '' } : x)) }))}>Me la quedo</button>
            </div>
          ))}
        </div>
      )}

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label="Ingresos fijos / mes" value={money(mIn, cur)} />
        <Stat label="Gastos fijos / mes" value={money(mOut, cur)} />
        <Stat label="Suscripciones / mes" value={money(mSubs, cur)} delta={`${money(mSubs * 12, cur)} al año`} />
        <Stat label="Margen libre / mes" value={money(mIn - mOut, cur)} deltaClass={mIn - mOut >= 0 ? 'pos' : 'neg'}
          delta={mIn > 0 ? `${Math.round(((mIn - mOut) / mIn) * 100)}% de los ingresos fijos` : null} />
      </div>

      <div className="grid g2">
        {section('Suscripciones', subs, 'sub', 'Apunta aquí cada suscripción que contrates para no olvidarte de cancelarla.')}
        {section('Ingresos fijos', incomes, 'income', 'Añade tu nómina u otros ingresos periódicos.')}
        <div className="span2">{section('Gastos fijos', expenses, 'expense', 'Alquiler, hipoteca, luz, gimnasio, seguros…')}</div>
      </div>

      {form && <RecurringForm item={form.item} preset={form.preset} onClose={() => setForm(null)} />}
    </>
  );
}
