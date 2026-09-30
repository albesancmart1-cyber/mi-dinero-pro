import { useMemo, useRef, useState, useEffect } from 'react';
import { useStore } from '../lib/store.jsx';
import { uid } from '../lib/defaults.js';
import { todayISO } from '../lib/finance.js';
import { parseAmount, money } from '../lib/format.js';
import { matchMerchant, merchantById, searchMerchants } from '../lib/merchants.js';
import { Modal, Seg } from '../components/ui.jsx';
import { CategoryIcon, Logo, TxAvatar } from '../components/icons.jsx';

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayISO(d);
}

const VISIBLE_CATS = 11;

/**
 * Campo de concepto con autocompletado de comercios (logo + categoría).
 * Reutilizable en otras pantallas (p. ej. Fijos).
 */
export function MerchantInput({ value, onChange, onPick, placeholder, autoFocus, categories = [] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchMerchants(value, 6), [value]);
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const show = open && results.length > 0 && !(results.length === 1 && results[0].name === value);

  function pick(m) {
    onPick(m);
    setOpen(false);
  }

  return (
    <div className="suggest">
      <input className="input" value={value} autoFocus={autoFocus} placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          if (e.key === 'Enter' && results[active]) { e.preventDefault(); pick(results[active]); }
        }} />
      {show && (
        <div className="suggest-list">
          {results.map((m, i) => (
            <button type="button" key={m.id} className={i === active ? 'on' : ''}
              onMouseDown={(e) => e.preventDefault()} onClick={() => pick(m)}>
              <span className="row">
                <Logo domain={m.domain} size={26} fallback={<CategoryIcon cat={catById[m.category]} size={26} />} />
                <span>{m.name}</span>
              </span>
              <span className="muted small">{catById[m.category]?.name || ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Alta rápida (o edición) de un movimiento. */
export default function QuickAdd({ onClose, editing }) {
  const { state, update } = useStore();
  const [type, setType] = useState(editing?.type || 'expense');
  const [amount, setAmount] = useState(editing ? String(editing.amount).replace('.', ',') : '');
  const [categoryId, setCategoryId] = useState(editing?.categoryId || '');
  const [catTouched, setCatTouched] = useState(!!editing);
  const [date, setDate] = useState(editing?.date || todayISO());
  const [note, setNote] = useState(editing?.note || '');
  const [merchant, setMerchant] = useState(editing?.merchant || null);
  const [allCats, setAllCats] = useState(false);
  const [flash, setFlash] = useState('');
  const amountRef = useRef(null);
  const cur = state.settings.currency;
  const catById = useMemo(() => Object.fromEntries(state.categories.map((c) => [c.id, c])), [state.categories]);

  useEffect(() => { amountRef.current?.focus(); }, [type]);

  // Categorías ordenadas por uso (últimos 120 movimientos)
  const cats = useMemo(() => {
    const usage = {};
    state.transactions.slice(-120).forEach((t) => { usage[t.categoryId] = (usage[t.categoryId] || 0) + 1; });
    return state.categories
      .map((c, i) => [c, i])
      .filter(([c]) => c.type === type)
      .sort((a, b) => (usage[b[0].id] || 0) - (usage[a[0].id] || 0) || a[1] - b[1])
      .map(([c]) => c);
  }, [state.categories, state.transactions, type]);

  // Atajos: combinaciones recientes (concepto + categoría + importe)
  const recents = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (let i = state.transactions.length - 1; i >= 0 && out.length < 6; i--) {
      const t = state.transactions[i];
      if (t.type !== type || t.recurringId || !t.note) continue;
      const k = `${t.note}|${t.categoryId}|${t.amount}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out;
  }, [state.transactions, type]);

  // Comercio detectado en el concepto (o elegido de la lista)
  const detected = merchantById(merchant) || matchMerchant(note);

  function onNote(v) {
    setNote(v);
    setMerchant(null);
    const m = matchMerchant(v);
    if (m && !catTouched && type === 'expense' && catById[m.category]) setCategoryId(m.category);
  }

  function pickMerchant(m) {
    setNote(m.name);
    setMerchant(m.id);
    if (!catTouched && type === 'expense' && catById[m.category]) setCategoryId(m.category);
  }

  const effectiveCat = categoryId && cats.some((c) => c.id === categoryId) ? categoryId : cats[0]?.id;
  const value = parseAmount(amount);
  const valid = value > 0 && effectiveCat;

  // Muestra las más usadas y siempre la seleccionada
  const shownCats = allCats ? cats : (() => {
    const top = cats.slice(0, VISIBLE_CATS);
    const sel = cats.find((c) => c.id === effectiveCat);
    return sel && !top.includes(sel) ? [...top.slice(0, VISIBLE_CATS - 1), sel] : top;
  })();

  function save(keepOpen) {
    if (!valid) return;
    const m = detected;
    const tx = {
      id: editing?.id || uid(),
      date,
      type,
      amount: Math.round(value * 100) / 100,
      categoryId: effectiveCat,
      note: note.trim(),
      ...(m && !m.generic ? { merchant: m.id } : {}),
      ...(editing?.recurringId ? { recurringId: editing.recurringId } : {}),
    };
    update((s) => ({
      ...s,
      transactions: editing
        ? s.transactions.map((t) => (t.id === editing.id ? tx : t))
        : [...s.transactions, tx],
    }));
    if (keepOpen) {
      setFlash(`Guardado: ${note.trim() || catById[effectiveCat]?.name} · ${money(tx.amount, cur)}`);
      setAmount('');
      setNote('');
      setMerchant(null);
      setCatTouched(false);
      amountRef.current?.focus();
      setTimeout(() => setFlash(''), 2000);
    } else onClose();
  }

  function remove() {
    if (!confirm('¿Eliminar este movimiento?')) return;
    update((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== editing.id) }));
    onClose();
  }

  return (
    <Modal
      title={editing ? 'Editar movimiento' : 'Nuevo movimiento'}
      onClose={onClose}
      footer={
        <>
          {editing && <button className="btn danger" onClick={remove}>Eliminar</button>}
          <span className="spacer" />
          {!editing && <button className="btn" disabled={!valid} onClick={() => save(true)}>Guardar y otro</button>}
          <button className="btn primary" disabled={!valid} onClick={() => save(false)}>Guardar</button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save(false); }}>
        <Seg
          big
          value={type}
          onChange={setType}
          options={[
            { value: 'expense', label: 'Gasto', className: 'expense' },
            { value: 'income', label: 'Ingreso', className: 'income' },
          ]}
        />
        <div className="amount-row">
          {detected && <TxAvatar item={{ merchant: detected.id }} cat={catById[effectiveCat]} size={44} />}
          <input
            ref={amountRef}
            className={`amount-input ${type}`}
            inputMode="decimal"
            placeholder={`0,00 ${cur === 'EUR' ? '€' : cur}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
            aria-label="Importe"
          />
        </div>
        {flash && <div className="alert info">✓ {flash}</div>}

        <MerchantInput value={note} onChange={onNote} onPick={pickMerchant} categories={state.categories}
          placeholder={type === 'expense' ? 'Comercio o concepto: Mercadona, Zara, Netflix…' : 'Concepto (opcional)'} />

        {recents.length > 0 && !editing && (
          <div>
            <h3 style={{ marginBottom: 8 }}>Repetir</h3>
            <div className="chips">
              {recents.map((t) => (
                <button type="button" key={t.id} className="chip chip-logo" onClick={() => {
                  setAmount(String(t.amount).replace('.', ','));
                  setCategoryId(t.categoryId);
                  setCatTouched(true);
                  setNote(t.note);
                  setMerchant(t.merchant || null);
                }}>
                  <TxAvatar item={t} cat={catById[t.categoryId]} size={22} />
                  {t.note} · {money(t.amount, cur)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 style={{ marginBottom: 8 }}>Categoría</h3>
          <div className="chips">
            {shownCats.map((c) => (
              <button type="button" key={c.id} className={`chip chip-logo${effectiveCat === c.id ? ' on' : ''}`}
                onClick={() => { setCategoryId(c.id); setCatTouched(true); }}>
                <CategoryIcon cat={c} size={22} />{c.name}
              </button>
            ))}
            {cats.length > VISIBLE_CATS && (
              <button type="button" className="chip" onClick={() => setAllCats(!allCats)}>
                {allCats ? 'Menos' : `Más (${cats.length - shownCats.length})`}
              </button>
            )}
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: 8 }}>Fecha</h3>
          <div className="row wrap">
            <button type="button" className={`chip${date === todayISO() ? ' on' : ''}`} onClick={() => setDate(todayISO())}>Hoy</button>
            <button type="button" className={`chip${date === yesterday() ? ' on' : ''}`} onClick={() => setDate(yesterday())}>Ayer</button>
            <input type="date" className="input" style={{ width: 170 }} value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
