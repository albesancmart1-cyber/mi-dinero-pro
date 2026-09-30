import { useMemo, useRef, useState, useEffect } from 'react';
import { useStore } from '../lib/store.jsx';
import { uid } from '../lib/defaults.js';
import { todayISO } from '../lib/finance.js';
import { parseAmount, money } from '../lib/format.js';
import { Modal, Seg } from '../components/ui.jsx';

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayISO(d);
}

/** Alta rápida (o edición) de un movimiento. */
export default function QuickAdd({ onClose, editing }) {
  const { state, update } = useStore();
  const [type, setType] = useState(editing?.type || 'expense');
  const [amount, setAmount] = useState(editing ? String(editing.amount).replace('.', ',') : '');
  const [categoryId, setCategoryId] = useState(editing?.categoryId || '');
  const [date, setDate] = useState(editing?.date || todayISO());
  const [note, setNote] = useState(editing?.note || '');
  const [flash, setFlash] = useState('');
  const amountRef = useRef(null);
  const cur = state.settings.currency;

  useEffect(() => { amountRef.current?.focus(); }, [type]);

  // Categorías ordenadas por uso (últimos 90 movimientos)
  const cats = useMemo(() => {
    const usage = {};
    state.transactions.slice(-90).forEach((t) => { usage[t.categoryId] = (usage[t.categoryId] || 0) + 1; });
    return state.categories
      .filter((c) => c.type === type)
      .sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0));
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

  const effectiveCat = categoryId && cats.some((c) => c.id === categoryId) ? categoryId : cats[0]?.id;
  const value = parseAmount(amount);
  const valid = value > 0 && effectiveCat;

  function save(keepOpen) {
    if (!valid) return;
    const tx = {
      id: editing?.id || uid(),
      date,
      type,
      amount: Math.round(value * 100) / 100,
      categoryId: effectiveCat,
      note: note.trim(),
      ...(editing?.recurringId ? { recurringId: editing.recurringId } : {}),
    };
    update((s) => ({
      ...s,
      transactions: editing
        ? s.transactions.map((t) => (t.id === editing.id ? tx : t))
        : [...s.transactions, tx],
    }));
    if (keepOpen) {
      setFlash(`Guardado: ${money(tx.amount, cur)}`);
      setAmount('');
      setNote('');
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
        <input
          ref={amountRef}
          className={`amount-input ${type}`}
          inputMode="decimal"
          placeholder={`0,00 ${cur === 'EUR' ? '€' : cur}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
          aria-label="Importe"
        />
        {flash && <div className="alert info">✓ {flash}</div>}

        {recents.length > 0 && !editing && (
          <div>
            <h3 style={{ marginBottom: 6 }}>Repetir</h3>
            <div className="chips">
              {recents.map((t) => (
                <button type="button" key={t.id} className="chip" onClick={() => {
                  setAmount(String(t.amount).replace('.', ','));
                  setCategoryId(t.categoryId);
                  setNote(t.note);
                }}>
                  {t.note} · {money(t.amount, cur)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 style={{ marginBottom: 6 }}>Categoría</h3>
          <div className="chips">
            {cats.map((c) => (
              <button type="button" key={c.id} className={`chip${effectiveCat === c.id ? ' on' : ''}`} onClick={() => setCategoryId(c.id)}>
                <span>{c.icon}</span>{c.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: 6 }}>Fecha</h3>
          <div className="row wrap">
            <button type="button" className={`chip${date === todayISO() ? ' on' : ''}`} onClick={() => setDate(todayISO())}>Hoy</button>
            <button type="button" className={`chip${date === yesterday() ? ' on' : ''}`} onClick={() => setDate(yesterday())}>Ayer</button>
            <input type="date" className="input" style={{ width: 170 }} value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
          </div>
        </div>

        <input className="input" placeholder="Concepto (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
