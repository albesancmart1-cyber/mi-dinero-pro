import { useState } from 'react';
import { useStore } from '../../lib/store.jsx';
import { ASSET_TYPES } from '../../lib/portfolio.js';
import { searchSymbols } from '../../lib/api.js';
import { parseWorkbook, finalize } from '../../lib/excelImport.js';
import { num } from '../../lib/format.js';
import { Modal } from '../../components/ui.jsx';

export default function ImportExcel({ onClose }) {
  const { state, update } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [data, setData] = useState(null);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr('');
    try {
      const XLSX = await import('xlsx');
      const d = await parseWorkbook(XLSX, await file.arrayBuffer(), searchSymbols);
      if (!d.positions.length) throw new Error('No se han encontrado posiciones en las hojas Broker.');
      setData(d);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  function setRow(id, k, v) {
    setData({ ...data, positions: data.positions.map((p) => (p.id === id ? { ...p, [k]: v } : p)) });
  }

  function apply(replace) {
    update((s) => ({
      ...s,
      brokers: replace ? data.brokers : [...s.brokers, ...data.brokers],
      positions: replace ? data.positions.map(finalize) : [...s.positions, ...data.positions.map(finalize)],
      settings: { ...s.settings, ...(data.targetAmount ? { targetAmount: data.targetAmount } : {}), ...(data.currency ? { currency: data.currency } : {}) },
    }));
    onClose();
  }

  return (
    <Modal title="Importar CARTERA.xlsx" onClose={onClose} wide
      footer={data && <>
        <button className="btn" onClick={onClose}>Cancelar</button>
        {state.positions.length > 0 && <button className="btn" onClick={() => apply(false)}>Añadir a las actuales</button>}
        <button className="btn primary" onClick={() => apply(true)}>{state.positions.length ? 'Sustituir mis posiciones' : 'Importar'}</button>
      </>}>
      {!data && (
        <div className="stack">
          <p className="small">Selecciona tu Excel de cartera. Se leerán las hojas <b>Broker1…5</b> (posiciones, nº de acciones y precio medio),
            <b> Cartera</b> (% deseado e importe objetivo), <b>Seguimiento</b> (precio objetivo a 5 años) y <b>Activos</b> (divisa, beta y tipo).
            Los tickers se asignan automáticamente y podrás revisarlos antes de importar.</p>
          <input type="file" accept=".xlsx,.xlsm,.xls" onChange={onFile} disabled={busy} />
          {busy && <div className="muted">Leyendo el Excel y buscando tickers…</div>}
          {err && <div className="alert crit">{err}</div>}
        </div>
      )}
      {data && (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Activo</th><th>Ticker</th><th>Tipo</th><th className="num">Acciones</th><th className="num">Precio medio</th><th className="num">% deseado</th></tr></thead>
            <tbody>
              {data.positions.map((p) => (
                <tr key={p.id}>
                  <td><div className="name">{p.name}</div><div className="sym">{data.brokers.find((b) => b.id === p.brokerId)?.name}</div></td>
                  <td><input className="cell" style={{ width: 100, textAlign: 'left' }} value={p.symbol} placeholder="manual" onChange={(e) => setRow(p.id, 'symbol', e.target.value.toUpperCase())} /></td>
                  <td>
                    <select className="input" style={{ padding: '4px 6px' }} value={p.type} onChange={(e) => setRow(p.id, 'type', e.target.value)}>
                      {ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="num">{num(p.qty, 6)}</td>
                  <td className="num">{num(p.avgPrice, 2)} {p.quoteCurrency || ''}</td>
                  <td className="num">{p.targetWeight != null ? `${num(p.targetWeight * 100, 2)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">Deja el ticker vacío para efectivo o activos sin cotización (se tomará el total invertido como valor).</p>
        </div>
      )}
    </Modal>
  );
}
