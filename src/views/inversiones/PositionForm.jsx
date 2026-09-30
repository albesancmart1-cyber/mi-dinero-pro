import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/store.jsx';
import { uid } from '../../lib/defaults.js';
import { ASSET_TYPES, applyTrade, fxRate } from '../../lib/portfolio.js';
import { searchSymbols, useMarket } from '../../lib/market.jsx';
import { money, num, parseAmount } from '../../lib/format.js';
import { Field, Modal, Seg } from '../../components/ui.jsx';

const MANUAL_TYPES = ['Fondos', 'Bonos', 'Efectivo', 'Otros'];

function toStr(v) {
  return v == null || v === '' ? '' : String(v).replace('.', ',');
}

/** Buscador de valores: teclea nombre o ticker. */
function SymbolSearch({ value, onPick }) {
  const [q, setQ] = useState(value || '');
  const [res, setRes] = useState([]);
  const [open, setOpen] = useState(false);
  const t = useRef(null);
  useEffect(() => setQ(value || ''), [value]);
  function onChange(e) {
    const v = e.target.value;
    setQ(v);
    onPick({ symbol: v.toUpperCase().trim() }, true);
    clearTimeout(t.current);
    if (v.trim().length < 2) { setRes([]); return; }
    t.current = setTimeout(async () => {
      const r = await searchSymbols(v.trim());
      setRes(r);
      setOpen(true);
    }, 300);
  }
  return (
    <div className="suggest">
      <input className="input" value={q} onChange={onChange} onFocus={() => res.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="Busca: Microsoft, MSFT, Iberdrola, BTC-EUR…" />
      {open && res.length > 0 && (
        <div className="suggest-list">
          {res.map((r) => (
            <button type="button" key={r.symbol} onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(r.symbol); setOpen(false); onPick(r, false); }}>
              <span><b>{r.symbol}</b> <span className="muted small">{r.name}</span></span>
              <span className="muted small">{r.exchange} {r.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PositionForm({ item, brokerId, onClose }) {
  const { state, update } = useStore();
  const { quotes } = useMarket();
  const [f, setF] = useState(() => ({
    brokerId: item?.brokerId || brokerId || state.brokers[0]?.id,
    name: item?.name || '',
    symbol: item?.symbol || '',
    type: item?.type || 'Pilares',
    qty: toStr(item?.qty),
    avgPrice: toStr(item?.avgPrice),
    manualValue: toStr(item?.manualValue),
    quoteCurrency: item?.quoteCurrency || '',
    targetWeight: item?.targetWeight != null ? toStr(Math.round(item.targetWeight * 10000) / 100) : '',
    target5y: toStr(item?.target5y),
    beta: toStr(item?.beta),
  }));
  const manual = !f.symbol.trim();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const q = quotes[f.symbol.trim()];
  const broker = state.brokers.find((b) => b.id === f.brokerId);

  function pick(r, typing) {
    setF((prev) => ({
      ...prev,
      symbol: r.symbol,
      name: typing ? prev.name : prev.name || r.name,
      type: !typing && r.type === 'ETF' ? 'ETFs' : !typing && r.type === 'MUTUALFUND' ? 'Fondos' : !typing && r.type === 'CRYPTOCURRENCY' ? 'Otros' : prev.type,
    }));
  }

  const valid = f.name.trim() && f.brokerId && (manual ? parseAmount(f.avgPrice) >= 0 : true);

  function save() {
    const n = (s) => (s === '' || s == null ? null : parseAmount(s));
    const pos = {
      ...(item || {}),
      id: item?.id || uid(),
      brokerId: f.brokerId,
      name: f.name.trim(),
      symbol: f.symbol.trim().toUpperCase(),
      type: f.type,
      qty: manual ? null : n(f.qty) || 0,
      avgPrice: n(f.avgPrice) || 0,
      manualValue: manual ? n(f.manualValue) : null,
      quoteCurrency: q?.currency || f.quoteCurrency || null,
      targetWeight: f.targetWeight === '' ? null : n(f.targetWeight) / 100,
      target5y: n(f.target5y),
      beta: n(f.beta),
    };
    update((s) => ({
      ...s,
      positions: item ? s.positions.map((p) => (p.id === item.id ? pos : p)) : [...s.positions, pos],
    }));
    onClose();
  }

  function remove() {
    if (!confirm(`¿Eliminar la posición ${item.name}?`)) return;
    update((s) => ({ ...s, positions: s.positions.filter((p) => p.id !== item.id) }));
    onClose();
  }

  return (
    <Modal title={item ? `Editar ${item.name}` : 'Nueva posición'} onClose={onClose} wide
      footer={<>
        {item && <button className="btn danger" onClick={remove}>Eliminar</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!valid} onClick={save}>Guardar</button>
      </>}>
      <div className="form-grid">
        <Field label="Ticker (Yahoo Finance)" full hint="Déjalo vacío para efectivo, fondos o activos sin cotización: introducirás el total invertido y su valor actual a mano.">
          <SymbolSearch value={f.symbol} onPick={pick} />
        </Field>
        {q && <div className="full alert info">Cotización actual: <b>{num(q.price, 4)} {q.currency}</b> · {q.name}</div>}
        <Field label="Nombre"><input className="input" value={f.name} onChange={set('name')} placeholder="Microsoft" /></Field>
        <Field label="Tipo">
          <select className="input" value={f.type} onChange={set('type')}>
            {ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Broker">
          <select className="input" value={f.brokerId} onChange={set('brokerId')}>
            {state.brokers.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>)}
          </select>
        </Field>
        {manual ? (
          <>
            <Field label={`Total invertido (${broker?.currency || ''})`}><input className="input" inputMode="decimal" value={f.avgPrice} onChange={set('avgPrice')} placeholder="1100" /></Field>
            <Field label={`Valor actual (${broker?.currency || ''})`} hint="Si lo dejas vacío, se usa el total invertido"><input className="input" inputMode="decimal" value={f.manualValue} onChange={set('manualValue')} /></Field>
          </>
        ) : (
          <>
            <Field label="Nº de acciones / participaciones"><input className="input" inputMode="decimal" value={f.qty} onChange={set('qty')} placeholder="2,7753" /></Field>
            <Field label={`Precio medio de compra (${q?.currency || f.quoteCurrency || 'divisa de cotización'})`}
              hint="En la divisa en la que cotiza el valor (p. ej. USD para Microsoft)">
              <input className="input" inputMode="decimal" value={f.avgPrice} onChange={set('avgPrice')} placeholder="449,67" />
            </Field>
          </>
        )}
        <Field label="% Cartera deseado" hint="Para calcular cuánto comprar o vender"><input className="input" inputMode="decimal" value={f.targetWeight} onChange={set('targetWeight')} placeholder="13,75" /></Field>
        {!manual && (
          <>
            <Field label="Precio objetivo a 5 años" hint="Hoja Seguimiento: retorno anual esperado"><input className="input" inputMode="decimal" value={f.target5y} onChange={set('target5y')} /></Field>
            <Field label="Beta (opcional)"><input className="input" inputMode="decimal" value={f.beta} onChange={set('beta')} placeholder="1,10" /></Field>
          </>
        )}
        {MANUAL_TYPES.includes(f.type) && !manual && <div className="full small muted">Este {f.type.toLowerCase()} tiene ticker, así que su valor se actualizará con la cotización.</div>}
      </div>
    </Modal>
  );
}

/** Registrar compra o venta: recalcula nº de acciones y precio medio. */
export function TradeForm({ item, onClose }) {
  const { state, update } = useStore();
  const { quotes, fx } = useMarket();
  const q = quotes[item.symbol];
  const [side, setSide] = useState('buy');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState(q ? String(Math.round(q.price * 100) / 100).replace('.', ',') : '');
  const [addCash, setAddCash] = useState(false);
  const preview = applyTrade(item, { side, qty: parseAmount(qty), price: parseAmount(price) });
  const valid = parseAmount(qty) > 0 && parseAmount(price) > 0 && (side === 'buy' || parseAmount(qty) <= (item.qty || 0) + 1e-9);
  const ccy = q?.currency || item.quoteCurrency || '';
  const rate = fxRate(fx, ccy, state.settings.currency) ?? 1;

  function save() {
    update((s) => ({
      ...s,
      positions: s.positions.map((p) => (p.id === item.id ? { ...preview, trades: [...(p.trades || []), {
        date: new Date().toISOString().slice(0, 10), side, qty: parseAmount(qty), price: parseAmount(price),
      }] } : p)),
      transactions: addCash ? [...s.transactions, {
        id: uid(), date: new Date().toISOString().slice(0, 10), type: side === 'buy' ? 'expense' : 'income',
        amount: Math.round(parseAmount(qty) * parseAmount(price) * rate * 100) / 100, categoryId: side === 'buy' ? 'c-otros-g' : 'c-otros-i',
        note: `${side === 'buy' ? 'Compra' : 'Venta'} ${item.name}`,
      }] : s.transactions,
    }));
    onClose();
  }

  return (
    <Modal title={`Operar · ${item.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!valid} onClick={save}>Registrar</button></>}>
      <div className="stack">
        <Seg big value={side} onChange={setSide} options={[{ value: 'buy', label: 'Compra', className: 'income' }, { value: 'sell', label: 'Venta', className: 'expense' }]} />
        <div className="form-grid">
          <Field label="Nº de acciones"><input className="input" autoFocus inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <Field label={`Precio (${ccy})`}><input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        </div>
        {valid && (
          <div className="alert info">
            Quedarán <b>{num(preview.qty, 6)}</b> acciones a precio medio <b>{num(preview.avgPrice, 4)} {ccy}</b>
            {side === 'sell' && <> · resultado de la venta: <b>{money(parseAmount(qty) * (parseAmount(price) - (item.avgPrice || 0)), ccy || state.settings.currency)}</b></>}
          </div>
        )}
        <label className="check small"><input type="checkbox" checked={addCash} onChange={(e) => setAddCash(e.target.checked)} /> Registrar también como movimiento en mis finanzas</label>
      </div>
    </Modal>
  );
}
