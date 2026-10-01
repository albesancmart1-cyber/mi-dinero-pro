import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { uid } from '../lib/defaults.js';
import { FREQUENCIES, monthlyEquivalent, paysPerYear, subscriptionAlerts, todayISO } from '../lib/finance.js';
import { dateLabel, money, parseAmount } from '../lib/format.js';
import { Empty, Field, Modal, Seg, Stat } from '../components/ui.jsx';
import { CategoryIcon, Logo, TxAvatar } from '../components/icons.jsx';
import { MerchantInput } from './QuickAdd.jsx';
import { matchMerchant } from '../lib/merchants.js';

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** "https://www.Inditex.com/es" → "inditex.com" */
export function toDomain(v) {
  const d = String(v || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
  return /^([a-z0-9-]+\.)+[a-z]{2,24}$/.test(d) ? d : '';
}

/** Campo "web para el logo" con vista previa. */
function LogoField({ value, onChange, label = 'Web para el logo (opcional)', hint = 'Por ejemplo inditex.com: se usará el logo de esa web', fallbackCat }) {
  const domain = toDomain(value);
  return (
    <Field label={label} full hint={hint}>
      <div className="row">
        <Logo domain={domain} size={38} fallback={<CategoryIcon cat={fallbackCat} size={38} />} />
        <input className="input" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="empresa.com" inputMode="url" autoCapitalize="off" />
      </div>
    </Field>
  );
}

/** Configuración de la nómina: empresa (con logo), neto, día de cobro y pagas extra. */
function SalaryForm({ item, onClose }) {
  const { state, update } = useStore();
  const cur = state.settings.currency;
  const [f, setF] = useState(() => ({
    payer: item?.payer || '',
    domain: item?.domain || '',
    merchant: item?.merchant || null,
    amount: item ? String(item.amount).replace('.', ',') : '',
    nextDate: item?.nextDate || todayISO(),
    pays: item?.extraPays?.length ? 14 : 12,
    extraPays: item?.extraPays?.length ? item.extraPays : [6, 12],
    extraAmount: item?.extraAmount ? String(item.extraAmount).replace('.', ',') : '',
    categoryId: item?.categoryId || 'c-nomina',
  }));
  const amount = parseAmount(f.amount);
  const extra = parseAmount(f.extraAmount) || amount || 0;
  const nExtra = f.pays === 14 ? f.extraPays.length : 0;
  const annual = (amount || 0) * 12 + extra * nExtra;
  const valid = amount > 0 && f.nextDate;
  const incomeCats = state.categories.filter((c) => c.type === 'income');
  const extraMonths = [...f.extraPays].sort((a, b) => a - b);

  function save() {
    const payer = f.payer.trim();
    const rec = {
      ...(item || {}),
      id: item?.id || uid(),
      kind: 'salary',
      type: 'income',
      name: payer ? `Nómina ${payer}` : 'Nómina',
      payer,
      domain: toDomain(f.domain) || '',
      merchant: f.merchant || null,
      amount: Math.round(amount * 100) / 100,
      frequency: 'monthly',
      categoryId: f.categoryId,
      nextDate: f.nextDate,
      anchorDay: Number(f.nextDate.slice(8, 10)),
      extraPays: f.pays === 14 ? extraMonths : [],
      extraAmount: f.pays === 14 && parseAmount(f.extraAmount) > 0 ? Math.round(parseAmount(f.extraAmount) * 100) / 100 : null,
      autoPost: item?.autoPost ?? true,
      active: true,
    };
    update((s) => ({ ...s, recurring: item ? s.recurring.map((r) => (r.id === item.id ? rec : r)) : [...s.recurring, rec] }));
    onClose();
  }
  function remove() {
    if (!confirm('¿Eliminar la nómina? Los cobros ya registrados se mantienen.')) return;
    update((s) => ({ ...s, recurring: s.recurring.filter((r) => r.id !== item.id) }));
    onClose();
  }
  const toggleMonth = (m) => setF((p) => ({ ...p, extraPays: p.extraPays.includes(m) ? p.extraPays.filter((x) => x !== m) : [...p.extraPays, m] }));

  return (
    <Modal title={item ? 'Editar nómina' : 'Configurar nómina'} onClose={onClose}
      footer={<>
        {item && <button className="btn danger" onClick={remove}>Eliminar</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!valid} onClick={save}>Guardar</button>
      </>}>
      <div className="form-grid">
        <Field label="Empresa" full>
          <MerchantInput value={f.payer} autoFocus categories={state.categories} placeholder="Nombre de tu empresa"
            onChange={(v) => setF((p) => ({ ...p, payer: v, merchant: null }))}
            onPick={(m) => setF((p) => ({ ...p, payer: m.name, merchant: m.id, domain: m.domain || p.domain }))} />
        </Field>
        <LogoField value={f.domain} onChange={(v) => setF((p) => ({ ...p, domain: v }))}
          label="Web de la empresa (para el logo)" hint="Por ejemplo inditex.com o bbva.es" fallbackCat={{ icon: 'briefcase' }} />
        <Field label="Importe neto mensual"><input className="input" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="2100,00" /></Field>
        <Field label="Próximo cobro" hint="Se repetirá ese día cada mes"><input type="date" className="input" value={f.nextDate} onChange={(e) => setF({ ...f, nextDate: e.target.value })} /></Field>
        <Field label="Pagas" full>
          <Seg value={f.pays} onChange={(v) => setF({ ...f, pays: v })} options={[
            { value: 12, label: '12 pagas (o prorrateadas)' }, { value: 14, label: '14 pagas' },
          ]} />
        </Field>
        {f.pays === 14 && (
          <>
            <Field label="Meses con paga extra" full>
              <div className="chips">
                {MONTHS_SHORT.map((m, i) => (
                  <button type="button" key={m} className={`chip${f.extraPays.includes(i + 1) ? ' on' : ''}`} onClick={() => toggleMonth(i + 1)}>{m}</button>
                ))}
              </div>
            </Field>
            <Field label="Importe de cada paga extra" hint="Si lo dejas vacío, igual que el neto mensual">
              <input className="input" inputMode="decimal" value={f.extraAmount} onChange={(e) => setF({ ...f, extraAmount: e.target.value })} placeholder={f.amount || '0,00'} />
            </Field>
          </>
        )}
        <Field label="Categoría">
          <select className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
            {incomeCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {amount > 0 && (
          <div className="full alert info">
            <span>Neto anual: <b>{money(annual, cur)}</b> · {12 + nExtra} pagas · equivale a <b>{money(annual / 12, cur)}</b> al mes.
              {nExtra > 0 && ` Las pagas extra se registran solas en ${extraMonths.map((m) => MONTHS_SHORT[m - 1].toLowerCase()).join(' y ')}.`}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

function RecurringForm({ item, onClose, preset }) {
  const { state, update } = useStore();
  const [f, setF] = useState(() => item ? { ...item, amount: String(item.amount).replace('.', ',') } : {
    name: '',
    type: preset === 'income' ? 'income' : preset === 'investment' ? 'investment' : 'expense',
    amount: '',
    frequency: 'monthly',
    categoryId: preset === 'sub' ? 'c-subs' : preset === 'income' ? 'c-extra' : preset === 'investment' ? 'c-inv-fondos' : '',
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
    const rec = { ...f, id: item?.id || uid(), amount: Math.round(amount * 100) / 100, categoryId: catId, name: f.name.trim(), anchorDay: Number(f.nextDate.slice(8, 10)), domain: toDomain(f.domain) || '' };
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
    <Modal title={item ? 'Editar' : f.isSubscription ? 'Nueva suscripción' : f.type === 'income' ? 'Nuevo ingreso fijo' : f.type === 'investment' ? 'Nueva aportación periódica' : 'Nuevo gasto fijo'} onClose={onClose}
      footer={<>
        {item && <button className="btn danger" onClick={remove}>Eliminar</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!valid} onClick={save}>Guardar</button>
      </>}>
      <div className="stack">
        <Seg big value={f.type} onChange={(v) => setF({ ...f, type: v, isSubscription: v === 'expense' ? f.isSubscription : false })} options={[
          { value: 'expense', label: 'Gasto', className: 'expense' }, { value: 'income', label: 'Ingreso', className: 'income' },
          { value: 'investment', label: 'Inversión', className: 'investment' },
        ]} />
        <div className="form-grid">
          <Field label="Nombre" full>
            <MerchantInput value={f.name} autoFocus categories={state.categories}
              placeholder={f.isSubscription ? 'Netflix, Spotify…' : f.type === 'income' ? 'Alquiler cobrado, freelance…' : f.type === 'investment' ? 'Aportación fondo indexado, plan de pensiones…' : 'Alquiler, Iberdrola, Movistar…'}
              onChange={(v) => {
                const m = matchMerchant(v);
                setF((p) => ({ ...p, name: v, merchant: null, ...(m && p.type === 'expense' && !item ? { categoryId: m.category, isSubscription: p.isSubscription || m.category === 'c-subs' } : {}) }));
              }}
              onPick={(m) => setF((p) => ({
                ...p, name: m.name, merchant: m.id,
                ...(p.type === 'expense' ? { categoryId: m.category, isSubscription: p.isSubscription || m.category === 'c-subs' } : {}),
              }))} />
          </Field>
          <Field label="Importe"><input className="input" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0,00" /></Field>
          <Field label="Frecuencia">
            <select className="input" value={f.frequency} onChange={set('frequency')}>
              {Object.entries(FREQUENCIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Categoría">
            <select className="input" value={catId} onChange={set('categoryId')}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
          {!f.merchant && <LogoField value={f.domain} onChange={(v) => setF((p) => ({ ...p, domain: v }))} fallbackCat={state.categories.find((c) => c.id === catId)} />}
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
      <TxAvatar item={r} cat={cat} />
      <div className="main" style={{ cursor: 'pointer' }} onClick={onEdit}>
        <div className="title">{r.name} {!r.active && <span className="badge">Cancelada</span>}</div>
        <div className="meta">
          {r.kind === 'salary' ? `${paysPerYear(r)} pagas` : FREQUENCIES[r.frequency]?.label} · {r.active ? `próximo ${dateLabel(r.nextDate)}` : `cancelada ${r.cancelledAt ? dateLabel(r.cancelledAt) : ''}`}
          {r.isSubscription && r.startDate && ` · desde ${dateLabel(r.startDate)}`}
          {r.cancelBy && r.active && <> · <span className="neg">cancelar antes del {dateLabel(r.cancelBy)}</span></>}
        </div>
      </div>
      <div className="right">
        <div className={`amt ${r.type === 'income' ? 'pos' : r.type === 'investment' ? 'inv' : ''}`}>{money(r.amount, cur)}</div>
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
  const salaries = list.filter((r) => r.kind === 'salary');
  const incomes = list.filter((r) => r.type === 'income' && r.kind !== 'salary');
  const expenses = list.filter((r) => r.type === 'expense' && !r.isSubscription);
  const investments = list.filter((r) => r.type === 'investment');
  const subs = list.filter((r) => r.isSubscription);
  const active = state.recurring.filter((r) => r.active);
  const mIn = active.filter((r) => r.type === 'income').reduce((s, r) => s + monthlyEquivalent(r), 0);
  const mOut = active.filter((r) => r.type === 'expense').reduce((s, r) => s + monthlyEquivalent(r), 0);
  const mSubs = active.filter((r) => r.isSubscription).reduce((s, r) => s + monthlyEquivalent(r), 0);
  const mInv = active.filter((r) => r.type === 'investment').reduce((s, r) => s + monthlyEquivalent(r), 0);
  const free = mIn - mOut - mInv;
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
            <RecRow key={r.id} r={r} cat={catById[r.categoryId]} cur={cur} onEdit={() => setForm(r.kind === 'salary' ? { salary: r } : { item: r })}
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
        <Stat label="Margen libre / mes" value={money(free, cur)} deltaClass={free >= 0 ? 'pos' : 'neg'}
          delta={mInv > 0 ? `tras invertir ${money(mInv, cur)}/mes` : mIn > 0 ? `${Math.round((free / mIn) * 100)}% de los ingresos fijos` : null} />
      </div>

      <div className="card salary-card" style={{ marginBottom: 18 }}>
        {salaries.length === 0 ? (
          <div className="row wrap">
            <CategoryIcon cat={{ icon: 'briefcase' }} size={44} />
            <div className="main" style={{ flex: 1 }}>
              <h2>Tu nómina</h2>
              <div className="small muted">Configura empresa, logo, importe neto, día de cobro y pagas extra. Se registrará sola cada mes.</div>
            </div>
            <button className="btn primary" onClick={() => setForm({ salary: null })}>Configurar nómina</button>
          </div>
        ) : salaries.map((r) => (
          <div className="row wrap salary-row" key={r.id}>
            <TxAvatar item={r} cat={catById[r.categoryId]} size={52} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div className="small muted">Nómina</div>
              <h2>{r.payer || 'Mi empresa'}</h2>
              <div className="small muted">
                {paysPerYear(r)} pagas · próximo cobro {dateLabel(r.nextDate)}
                {r.extraPays?.length > 0 && ` · extra en ${r.extraPays.map((m) => MONTHS_SHORT[m - 1].toLowerCase()).join(' y ')}`}
              </div>
            </div>
            <div className="right">
              <div className="stat"><div className="value tnum pos">{money(r.amount, cur)}</div></div>
              <div className="small muted">{money(monthlyEquivalent(r) * 12, cur)} netos al año</div>
            </div>
            <button className="btn sm" onClick={() => setForm({ salary: r })}>Editar</button>
          </div>
        ))}
      </div>

      <div className="grid g2">
        {section('Suscripciones', subs, 'sub', 'Apunta aquí cada suscripción que contrates para no olvidarte de cancelarla.')}
        {section('Otros ingresos fijos', incomes, 'income', 'Alquileres cobrados, trabajos recurrentes…')}
        {section('Gastos fijos', expenses, 'expense', 'Alquiler, hipoteca, luz, gimnasio, seguros…')}
        {section('Inversión periódica', investments, 'investment', 'Aportaciones automáticas a fondos, plan de pensiones, cripto…')}
      </div>

      {form && 'salary' in form && <SalaryForm item={form.salary} onClose={() => setForm(null)} />}
      {form && !('salary' in form) && <RecurringForm item={form.item} preset={form.preset} onClose={() => setForm(null)} />}
    </>
  );
}
