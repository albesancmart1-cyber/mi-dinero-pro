import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { defaultState, uid } from '../lib/defaults.js';
import { money, parseAmount } from '../lib/format.js';
import { Field } from '../components/ui.jsx';
import { CATEGORY_GLYPHS, CategoryIcon } from '../components/icons.jsx';

function Accounts() {
  const { state, update } = useStore();
  const cur = state.settings.currency;
  const [name, setName] = useState('');
  const [bal, setBal] = useState('');
  const setAcc = (id, patch) => update((s) => ({ ...s, accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  return (
    <div className="card">
      <div className="card-head"><h2>Cuentas y ahorro</h2></div>
      <p className="small muted" style={{ marginTop: 0 }}>Saldo de tus cuentas bancarias, colchón de emergencia… Se suman a tu patrimonio junto con la cartera.</p>
      <div className="list">
        {state.accounts.map((a) => (
          <div className="list-item" key={a.id}>
            <div className="main"><input className="input" value={a.name} onChange={(e) => setAcc(a.id, { name: e.target.value })} /></div>
            <input className="input" style={{ width: 140 }} inputMode="decimal" defaultValue={String(a.balance).replace('.', ',')}
              onBlur={(e) => setAcc(a.id, { balance: parseAmount(e.target.value) || 0 })} />
            <button className="icon-btn" aria-label="Eliminar" onClick={() => update((s) => ({ ...s, accounts: s.accounts.filter((x) => x.id !== a.id) }))}>✕</button>
          </div>
        ))}
      </div>
      <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        update((s) => ({ ...s, accounts: [...s.accounts, { id: uid(), name: name.trim(), balance: parseAmount(bal) || 0 }] }));
        setName(''); setBal('');
      }}>
        <input className="input" placeholder="Cuenta nómina" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" style={{ width: 140 }} inputMode="decimal" placeholder={money(0, cur)} value={bal} onChange={(e) => setBal(e.target.value)} />
        <button className="btn">Añadir</button>
      </form>
    </div>
  );
}

function IconPicker({ value, onPick }) {
  return (
    <div className="icon-picker">
      {Object.keys(CATEGORY_GLYPHS).map((g) => (
        <button type="button" key={g} className={value === g ? 'on' : ''} onClick={() => onPick(g)} aria-label={g}>
          <CategoryIcon cat={{ icon: g }} size={30} />
        </button>
      ))}
    </div>
  );
}

function Categories() {
  const { state, update } = useStore();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('box');
  const [type, setType] = useState('expense');
  const [picking, setPicking] = useState(null); // id de la categoría cuyo icono se elige, o 'new'
  const used = new Set(state.transactions.map((t) => t.categoryId).concat(state.recurring.map((r) => r.categoryId)));
  const setCat = (id, patch) => update((s) => ({ ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  return (
    <div className="card span2">
      <div className="card-head"><h2>Categorías</h2><span className="small muted">Toca un icono para cambiarlo</span></div>
      {['expense', 'income', 'investment'].map((tp) => (
        <div key={tp} style={{ marginBottom: 14 }}>
          <h3 style={{ marginBottom: 8 }}>{{ expense: 'Gastos', income: 'Ingresos', investment: 'Inversión' }[tp]}</h3>
          <div className="cat-grid">
            {state.categories.filter((c) => c.type === tp).map((c) => (
              <div key={c.id} className="cat-edit">
                <button type="button" className="icon-btn" style={{ padding: 0 }} onClick={() => setPicking(picking === c.id ? null : c.id)} aria-label="Cambiar icono">
                  <CategoryIcon cat={c} size={32} />
                </button>
                <input className="input" value={c.name} onChange={(e) => setCat(c.id, { name: e.target.value })} />
                {!used.has(c.id) && <button className="icon-btn" aria-label="Eliminar"
                  onClick={() => update((s) => ({ ...s, categories: s.categories.filter((x) => x.id !== c.id) }))}>✕</button>}
                {picking === c.id && <IconPicker value={c.icon} onPick={(g) => { setCat(c.id, { icon: g }); setPicking(null); }} />}
              </div>
            ))}
          </div>
        </div>
      ))}
      <form className="row wrap" onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        update((s) => ({ ...s, categories: [...s.categories, { id: `c-${uid()}`, name: name.trim(), icon, type }] }));
        setName('');
      }}>
        <button type="button" className="icon-btn" style={{ padding: 0 }} onClick={() => setPicking(picking === 'new' ? null : 'new')} aria-label="Icono de la nueva categoría">
          <CategoryIcon cat={{ icon }} size={36} />
        </button>
        <input className="input" style={{ width: 200 }} placeholder="Nueva categoría" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="input" style={{ width: 120 }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="expense">Gasto</option><option value="income">Ingreso</option><option value="investment">Inversión</option>
        </select>
        <button className="btn">Añadir</button>
      </form>
      {picking === 'new' && <IconPicker value={icon} onPick={(g) => { setIcon(g); setPicking(null); }} />}
    </div>
  );
}

export const PALETTES = [
  { id: 'grafito', name: 'Grafito', desc: 'Neutro, gris espacial', colors: ['#1d1d1f', '#c9ccd2', '#eeeff1'] },
  { id: 'marino', name: 'Azul marino', desc: 'Banca clásica', colors: ['#1f3a5f', '#b7c5d8', '#edf0f4'] },
  { id: 'bosque', name: 'Verde inglés', desc: 'Banca privada', colors: ['#1e4a3a', '#bfd0c4', '#eff1ed'] },
  { id: 'titanio', name: 'Titanio', desc: 'Cálido, champán y piedra', colors: ['#5c5046', '#d8d1c6', '#f2f0ec'] },
  { id: 'burdeos', name: 'Burdeos', desc: 'Sobrio y cálido', colors: ['#6b1f30', '#dcc6c9', '#f3f0f0'] },
];

function Appearance() {
  const { state, update } = useStore();
  const current = state.settings.palette || 'grafito';
  return (
    <div className="card span2">
      <div className="card-head"><h2>Apariencia</h2></div>
      <div className="palettes">
        {PALETTES.map((p) => (
          <button key={p.id} className={`palette${current === p.id ? ' on' : ''}`}
            onClick={() => update((s) => ({ ...s, settings: { ...s.settings, palette: p.id } }))}>
            <span className="swatches">{p.colors.map((c) => <i key={c} style={{ background: c }} />)}</span>
            <b>{p.name}</b>
            <span className="small muted">{p.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Sync() {
  const { pin, setPin, sync, pull } = useStore();
  const [v, setV] = useState(pin);
  return (
    <div className="card">
      <div className="card-head"><h2>Sincronización en la nube</h2></div>
      <p className="small muted" style={{ marginTop: 0 }}>
        Tus datos se guardan en este dispositivo. Para tenerlos en el móvil y el ordenador a la vez (y que se guarde un histórico diario de la cartera),
        introduce el PIN configurado en Vercel (<code>APP_PIN</code>). Los datos se guardan en tu Firestore.
      </p>
      <div className="row">
        <input className="input" type="password" placeholder="PIN" value={v} onChange={(e) => setV(e.target.value)} style={{ maxWidth: 200 }} />
        <button className="btn primary" onClick={() => setPin(v.trim())}>{pin ? 'Cambiar' : 'Activar'}</button>
        {pin && <button className="btn" onClick={() => pull()}>Sincronizar ahora</button>}
        {pin && <button className="btn ghost" onClick={() => { setPin(''); setV(''); }}>Desactivar</button>}
      </div>
      {sync.status !== 'off' && <p className={`small ${sync.status === 'error' ? 'neg' : 'muted'}`}>{sync.message}</p>}
    </div>
  );
}

export default function Ajustes() {
  const { state, update } = useStore();
  const [cur, setCur] = useState(state.settings.currency);

  function exportJson() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    a.download = `mi-dinero-pro-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }
  function importJson(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then((txt) => {
      try {
        const s = JSON.parse(txt);
        if (!s || !Array.isArray(s.transactions)) throw new Error('Formato no válido');
        if (confirm('Esto sustituirá todos tus datos por los de la copia. ¿Continuar?')) update(() => ({ ...defaultState(), ...s }));
      } catch (ex) {
        alert(`No se pudo importar: ${ex.message}`);
      }
    });
  }

  return (
    <>
      <div className="page-head"><div><h1>Ajustes</h1></div></div>
      <div className="grid g2">
        <Appearance />
        <div className="card">
          <div className="card-head"><h2>General</h2></div>
          <div className="form-grid">
            <Field label="Divisa principal" hint="Toda la cartera se convierte a esta divisa">
              <input className="input" maxLength={3} value={cur} onChange={(e) => setCur(e.target.value.toUpperCase())}
                onBlur={() => /^[A-Z]{3}$/.test(cur) && update((s) => ({ ...s, settings: { ...s.settings, currency: cur } }))} />
            </Field>
          </div>
        </div>
        <Sync />
        <Accounts />
        <Categories />
        <div className="card span2">
          <div className="card-head"><h2>Copia de seguridad</h2></div>
          <div className="row wrap">
            <button className="btn" onClick={exportJson}>Descargar copia (JSON)</button>
            <label className="btn">Restaurar copia<input type="file" accept="application/json" hidden onChange={importJson} /></label>
            <span className="spacer" />
            <button className="btn danger" onClick={() => {
              if (confirm('¿Borrar TODOS los datos de este dispositivo? Descarga antes una copia.')) update(() => ({ ...defaultState() }));
            }}>Borrar todo</button>
          </div>
        </div>
      </div>
    </>
  );
}
