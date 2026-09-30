import { useMemo, useState } from 'react';
import { useStore } from '../../lib/store.jsx';
import { useMarket } from '../../lib/market.jsx';
import { ASSET_TYPES, analyzePortfolio, compositionSlices, weightsByType } from '../../lib/portfolio.js';
import { excelSeed, uid } from '../../lib/defaults.js';
import { money, num, parseAmount, pct, signedMoney, tone, dateLabel } from '../../lib/format.js';
import { Donut, LineChart, SERIES } from '../../components/charts.jsx';
import { Empty, Field, Modal, Stat } from '../../components/ui.jsx';
import { PositionForm, TradeForm } from './PositionForm.jsx';
import ImportExcel from './ImportExcel.jsx';
import { AssetLogo } from '../../components/icons.jsx';

const TYPE_COLOR = Object.fromEntries(ASSET_TYPES.map((t, i) => [t, SERIES[i]]));

function MarketStatus() {
  const { status, refresh } = useMarket();
  const t = status.time ? new Date(status.time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div className="row small muted wrap">
      <span>{status.loading ? 'Actualizando cotizaciones…' : t ? `Cotizaciones de las ${t} · Yahoo Finance` : 'Sin cotizaciones'}</span>
      <button className="btn sm" onClick={refresh} disabled={status.loading}>↻ Actualizar</button>
      {status.error && <span className="neg">{status.error}</span>}
    </div>
  );
}

/** Pestaña "Cartera": réplica de la hoja Cartera del Excel. */
function Cartera({ onEditAsset }) {
  const { state, update, history: serverHistory } = useStore();
  const { portfolio: pf } = useMarket();
  const cur = state.settings.currency;
  const [editTarget, setEditTarget] = useState(false);
  const types = weightsByType(pf);
  const comp = compositionSlices(pf);
  const sliceColor = (e) => (e.slot ? SERIES[e.slot - 1] : 'var(--muted)');
  const fmtPct = (v) => pct(v, 1);

  const history = useMemo(() => {
    const m = new Map();
    serverHistory.forEach((h) => m.set(h.date, { x: h.date, value: h.value, invested: h.invested }));
    state.history.forEach((h) => m.set(h.date, { x: h.date, value: h.value, invested: h.invested }));
    return [...m.values()].sort((a, b) => a.x.localeCompare(b.x));
  }, [state.history, serverHistory]);

  function setTargetWeight(asset, v) {
    const w = v === '' ? null : parseAmount(v) / 100;
    // El % deseado se guarda en todas las posiciones del mismo activo
    const ids = new Set(asset.positions.map((p) => p.id));
    update((s) => ({ ...s, positions: s.positions.map((p) => (ids.has(p.id) ? { ...p, targetWeight: w } : p)) }));
  }

  return (
    <>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label={`Importe invertido en ${cur}`} value={money(pf.totalInvested, cur)} />
        <Stat label={`Importe actual en ${cur}`} value={money(pf.totalValue, cur)}
          delta={pf.dayChange ? `${signedMoney(pf.dayChange, cur)} hoy` : null} deltaClass={tone(pf.dayChange)} />
        <Stat label="Rentabilidad acumulada" value={pct(pf.returnPct, 2, true)} delta={signedMoney(pf.pnl, cur)} deltaClass={tone(pf.pnl)} />
        <div className="card stat" style={{ cursor: 'pointer' }} onClick={() => setEditTarget(true)}>
          <div className="label">Importe OBJETIVO en {cur} ✎</div>
          <div className="value tnum">{money(state.settings.targetAmount, cur, 0)}</div>
          <div className="delta">{state.settings.targetAmount > 0 ? `${pct(pf.totalValue / state.settings.targetAmount, 0)} alcanzado` : 'Sin objetivo'}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2>Resumen cartera</h2>
          <MarketStatus />
        </div>
        {pf.assets.length === 0 ? <Empty>No tienes posiciones. Ve a <b>Posiciones</b> para añadirlas o importa tu Excel.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Empresa o activo</th><th>Tipo</th>
                  <th className="num">Invertido</th><th className="num">Actual</th><th className="num">% Rent.</th>
                  <th className="num">% Actual</th><th className="num">% Deseado</th>
                  <th className="num">Comprar / (vender)</th><th className="num">Comprar / (vender) OBJETIVO</th>
                </tr>
              </thead>
              <tbody>
                {pf.assets.map((a) => (
                  <tr key={a.key}>
                    <td className="click" style={{ cursor: 'pointer' }} onClick={() => onEditAsset(a.positions[0])}>
                      <div className="asset-cell"><AssetLogo symbol={a.symbol} name={a.name} /><div>
                      <div className="name">{a.name}</div>
                      <div className="sym">{a.symbol || 'manual'}{a.price != null && ` · ${num(a.price, 2)} ${a.quoteCurrency}`}
                        {a.quote?.changePct != null && <span className={tone(a.quote.changePct)}> {pct(a.quote.changePct, 2, true)}</span>}
                      </div>
                      </div></div>
                    </td>
                    <td><span className="badge"><i style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_COLOR[a.type] }} />{a.type}</span></td>
                    <td className="num">{money(a.invested, cur)}</td>
                    <td className="num">{a.missing ? <span className="muted">sin precio</span> : money(a.value, cur)}</td>
                    <td className={`num ${tone(a.returnPct)}`}>{pct(a.returnPct, 2, true)}</td>
                    <td className="num">{pct(a.weight, 2)}</td>
                    <td className="num">
                      <input className="cell" inputMode="decimal" defaultValue={a.targetWeight != null ? num(a.targetWeight * 100, 2) : ''}
                        key={`${a.key}-${a.targetWeight}`}
                        onBlur={(e) => setTargetWeight(a, e.target.value)} aria-label={`% deseado ${a.name}`} />%
                    </td>
                    <td className={`num ${tone(a.rebalance)}`}>{a.rebalance != null && Math.abs(a.rebalance) >= 0.5 ? signedMoney(a.rebalance, cur) : '—'}</td>
                    <td className={`num ${tone(a.rebalanceTarget)}`}>{a.rebalanceTarget != null ? signedMoney(a.rebalanceTarget, cur) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td className="num">{money(pf.totalInvested, cur)}</td>
                  <td className="num">{money(pf.totalValue, cur)}</td>
                  <td className={`num ${tone(pf.returnPct)}`}>{pct(pf.returnPct, 2, true)}</td>
                  <td className="num">{pct(pf.weightSum, 0)}</td>
                  <td className={`num ${Math.abs(pf.targetWeightSum - 1) > 0.001 ? 'neg' : ''}`}>{pct(pf.targetWeightSum, 2)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {pf.assets.length > 0 && Math.abs(pf.targetWeightSum - 1) > 0.001 && (
          <p className="small neg" style={{ marginTop: 10 }}>La suma de los % deseados es {pct(pf.targetWeightSum, 2)}; debería ser 100%.</p>
        )}
        <p className="small muted" style={{ marginTop: 10 }}>
          <b>Comprar / (vender)</b>: lo que falta para llegar al % deseado con el valor actual de la cartera.
          <b> OBJETIVO</b>: lo mismo pero sobre el importe objetivo ({money(state.settings.targetAmount, cur, 0)}).
        </p>
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head"><h2>Composición actual</h2><span className="small muted">peso sobre {money(pf.totalValue, cur, 0)}</span></div>
          {comp.current.length ? (
            <Donut items={comp.current.map((e) => ({ label: e.label, value: e.current, color: sliceColor(e) }))}
              center={['Actual', money(pf.totalValue, cur, 0)]} format={fmtPct} />
          ) : <Empty>Sin posiciones</Empty>}
        </div>
        <div className="card">
          <div className="card-head"><h2>Composición deseada</h2><span className="small muted">según tus % deseados</span></div>
          {comp.target.length ? (
            <>
              <Donut items={comp.target.map((e) => ({ label: e.label, value: e.target, color: sliceColor(e) }))}
                center={['Deseada', state.settings.targetAmount > 0 ? money(state.settings.targetAmount, cur, 0) : '']} format={fmtPct} />
              {Math.abs(comp.targetSum - 1) > 0.001 && (
                <p className="small neg" style={{ marginBottom: 0 }}>Tus % deseados suman {pct(comp.targetSum, 1)}: el gráfico los reparte sobre ese total.</p>
              )}
              {comp.deviations[0] && Math.abs(comp.deviations[0].diff) >= 0.005 && (
                <p className="small muted" style={{ marginBottom: 0 }}>
                  Mayores desviaciones: {comp.deviations.slice(0, 3).filter((d) => Math.abs(d.diff) >= 0.005).map((d) => `${d.label} ${d.diff > 0 ? '+' : '−'}${pct(Math.abs(d.diff), 1)}`).join(' · ')}
                </p>
              )}
            </>
          ) : <Empty>Indica el % deseado de cada posición en la tabla de arriba para ver cómo quedaría tu cartera.</Empty>}
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-head"><h2>Distribución por tipo</h2></div>
          {types.length ? (
            <Donut items={types.map((t) => ({ label: t.type, value: t.value, color: TYPE_COLOR[t.type] }))}
              center={[money(pf.totalValue, cur, 0), 'valor actual']} format={(v) => money(v, cur)} />
          ) : <Empty>Sin datos</Empty>}
        </div>
        <div className="card">
          <div className="card-head"><h2>Evolución de la cartera</h2></div>
          {history.length >= 2 ? (
            <LineChart data={history} format={(v) => money(v, cur, 0)} xLabel={(x) => dateLabel(x)}
              series={[{ key: 'value', label: 'Valor', color: 'var(--s1)' }, { key: 'invested', label: 'Invertido', color: 'var(--s2)', dashed: true }]} />
          ) : <Empty>Se guarda una foto diaria de tu cartera. En unos días verás aquí su evolución.</Empty>}
        </div>
      </div>

      {editTarget && <TargetModal onClose={() => setEditTarget(false)} />}
    </>
  );
}

function TargetModal({ onClose }) {
  const { state, update } = useStore();
  const [v, setV] = useState(String(state.settings.targetAmount || ''));
  return (
    <Modal title="Importe objetivo" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" onClick={() => { update((s) => ({ ...s, settings: { ...s.settings, targetAmount: parseAmount(v) || 0 } })); onClose(); }}>Guardar</button></>}>
      <Field label={`Importe al que quieres llevar tu cartera (${state.settings.currency})`}>
        <input className="input" autoFocus inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} />
      </Field>
    </Modal>
  );
}

/** Pestaña "Posiciones": réplica de las hojas Broker1..N. */
function Posiciones({ onEdit, onTrade }) {
  const { state, update } = useStore();
  const { portfolio: pf } = useMarket();
  const cur = state.settings.currency;
  const [brokerForm, setBrokerForm] = useState(null);
  const [importing, setImporting] = useState(false);
  const rowsById = Object.fromEntries(pf.rows.map((r) => [r.id, r]));

  function loadSeed() {
    if (state.positions.length && !confirm('Esto sustituirá tus posiciones actuales por las de tu Excel. ¿Continuar?')) return;
    const seed = excelSeed();
    update((s) => ({ ...s, brokers: seed.brokers, positions: seed.positions, settings: { ...s.settings, ...seed.settings } }));
  }

  return (
    <>
      <div className="row wrap" style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => onEdit({ brokerId: state.brokers[0]?.id })}>+ Nueva posición</button>
        <button className="btn" onClick={() => setBrokerForm({})}>+ Nuevo broker</button>
        <button className="btn" onClick={() => setImporting(true)}>Importar Excel (CARTERA.xlsx)</button>
        {state.positions.length === 0 && <button className="btn" onClick={loadSeed}>Cargar mi cartera del Excel</button>}
        <span className="spacer" />
        <MarketStatus />
      </div>

      {state.brokers.map((b) => {
        const rows = state.positions.filter((p) => p.brokerId === b.id).map((p) => rowsById[p.id]).filter(Boolean);
        const total = rows.reduce((s, r) => s + (r.value || 0), 0);
        return (
          <div className="card" key={b.id} style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <h2>{b.name} <span className="badge">{b.currency}</span></h2>
                <div className="small muted">Importe total: {money(total, cur)}</div>
              </div>
              <div className="row">
                <button className="btn sm" onClick={() => onEdit({ brokerId: b.id })}>+ Posición</button>
                <button className="btn sm ghost" onClick={() => setBrokerForm(b)}>Editar</button>
              </div>
            </div>
            {rows.length === 0 ? <Empty>Sin posiciones en este broker.</Empty> : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Empresa o activo</th><th className="num">Nº acciones</th><th className="num">Precio medio</th>
                      <th className="num">Precio actual</th><th className="num">Invertido</th><th className="num">Valor a mercado</th>
                      <th className="num">% Rent.</th><th className="num">Valor ({cur})</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="click" onClick={() => onEdit(r)}>
                        <td><div className="asset-cell"><AssetLogo symbol={r.symbol} name={r.name} /><div><div className="name">{r.name}</div><div className="sym">{r.symbol || 'manual'} · {r.type}</div></div></div></td>
                        <td className="num">{r.market ? num(r.qty, 6) : '—'}</td>
                        <td className="num">{r.market ? `${num(r.avgPrice, 2)} ${r.quoteCurrency}` : '—'}</td>
                        <td className="num">{r.price != null ? `${num(r.price, 2)} ${r.quoteCurrency}` : r.market ? <span className="muted">—</span> : 'manual'}</td>
                        <td className="num">{money(r.investedLocal, r.quoteCurrency || cur)}</td>
                        <td className="num">{r.valueLocal != null ? money(r.valueLocal, r.quoteCurrency || cur) : '—'}</td>
                        <td className={`num ${tone(r.returnPct)}`}>{pct(r.returnPct, 2, true)}</td>
                        <td className="num">{money(r.value, cur)}</td>
                        <td className="num">
                          {r.market && <button className="btn sm" onClick={(e) => { e.stopPropagation(); onTrade(r); }}>Operar</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      <p className="small muted">
        Consejos: el precio medio va en la divisa de cotización (Londres en libras, no peniques). Para efectivo, fondos u otros activos
        sin ticker, indica el total invertido y su valor actual. Los tickers son los de Yahoo Finance: MSFT, SAN.MC (Madrid), CSU.TO (Toronto),
        2330.TW (Taiwán), BTC-EUR…
      </p>
      {brokerForm && <BrokerForm item={brokerForm.id ? brokerForm : null} onClose={() => setBrokerForm(null)} />}
      {importing && <ImportExcel onClose={() => setImporting(false)} />}
    </>
  );
}

function BrokerForm({ item, onClose }) {
  const { state, update } = useStore();
  const [name, setName] = useState(item?.name || `Broker${state.brokers.length + 1}`);
  const [currency, setCurrency] = useState(item?.currency || state.settings.currency);
  const used = item && state.positions.some((p) => p.brokerId === item.id);
  function save() {
    const b = { id: item?.id || uid(), name: name.trim(), currency: currency.toUpperCase().trim() };
    update((s) => ({ ...s, brokers: item ? s.brokers.map((x) => (x.id === item.id ? b : x)) : [...s.brokers, b] }));
    onClose();
  }
  function remove() {
    if (!confirm('¿Eliminar este broker?')) return;
    update((s) => ({ ...s, brokers: s.brokers.filter((x) => x.id !== item.id) }));
    onClose();
  }
  return (
    <Modal title={item ? 'Editar broker' : 'Nuevo broker'} onClose={onClose}
      footer={<>{item && <button className="btn danger" disabled={used} title={used ? 'Tiene posiciones' : ''} onClick={remove}>Eliminar</button>}
        <span className="spacer" /><button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!name.trim() || !/^[A-Za-z]{3}$/.test(currency)} onClick={save}>Guardar</button></>}>
      <div className="form-grid">
        <Field label="Nombre"><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Divisa de la cuenta"><input className="input" value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

/** Pestaña "Análisis": réplica de las hojas Análisis y Calc. */
function Analisis() {
  const { state, update } = useStore();
  const { portfolio: pf, quotes } = useMarket();
  const rules = state.settings.rules || {};
  const an = analyzePortfolio(pf, rules, quotes['^GSPC']);
  const [editRules, setEditRules] = useState(false);

  return (
    <>
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <Stat label="Nº de empresas" value={an.companies} delta="Referencia: 10–15" />
        <Stat label="Beta de cartera (solo empresas)" value={an.beta != null ? num(an.beta, 2) : '—'}
          delta={an.beta == null ? 'Añade la beta en cada posición' : an.beta > 1.2 ? 'Más volátil que el mercado' : an.beta < 0.8 ? 'Menos volátil que el mercado' : 'Similar al mercado'} />
        <Stat label="S&P 500 vs máximo 52 semanas" value={an.market ? pct(an.market.drawdown, 1) : '—'}
          delta={an.market ? `${num(an.market.price, 0)} · máx. ${num(an.market.high52, 0)}` : 'Sin datos'} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h2>Análisis de cartera</h2><button className="btn sm" onClick={() => setEditRules(true)}>Ajustar referencias</button></div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Indicador</th><th className="num">Valor</th><th className="num">Referencia</th><th>Comentario (orientativo)</th></tr></thead>
            <tbody>
              {an.checks.map((c) => (
                <tr key={c.id}>
                  <td><span className={`status ${c.status}`}>{c.label}</span></td>
                  <td className="num"><b>{c.value}</b></td>
                  <td className="num muted">{c.ref}</td>
                  <td className="small">{c.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-head"><h2>Posiciones en pérdidas</h2></div>
          {an.losers.length === 0 ? <Empty>Ninguna posición en pérdidas 🎉</Empty> : (
            <div className="list">
              {an.losers.map((l) => (
                <div className="list-item" key={l.name}>
                  <div className="main">
                    <div className="title">{l.name}</div>
                    {l.alert && <div className="meta">Debes revisar si has cometido un error de inversión o si, por el contrario, podría ser una oportunidad.</div>}
                  </div>
                  <div className="amt neg">{pct(l.returnPct, 2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h2>Reglas inversor agresivo</h2></div>
          <table className="tbl">
            <thead><tr><th>Tipo</th><th className="num">% cartera</th><th className="num">Actual</th><th>Máximo por empresa</th></tr></thead>
            <tbody>
              {[
                ['Pilares', '80–100%', 'Pilares', '20–25% cada una'],
                ['Mid Caps', '10–20%', 'Micro/Small/Mid Caps', '15% cada una'],
                ['Small Caps', '0–10%', null, '10% cada una'],
              ].map(([l, r, t, m]) => (
                <tr key={l}>
                  <td>{l}</td><td className="num">{r}</td>
                  <td className="num">{t ? pct(pf.assets.filter((a) => a.type === t).reduce((s, a) => s + a.weight, 0), 1) : ''}</td>
                  <td className="small">{m}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {an.ruleViolations.length > 0 && (
            <div className="alert" style={{ marginTop: 12 }}>⚠️ {an.ruleViolations.join(' · ')}</div>
          )}
        </div>
      </div>
      {editRules && <RulesModal rules={rules} onClose={() => setEditRules(false)} onSave={(r) => update((s) => ({ ...s, settings: { ...s.settings, rules: r } }))} />}
    </>
  );
}

function RulesModal({ rules, onClose, onSave }) {
  const fields = [
    ['cashWeight', 'Peso de efectivo recomendado (%)', 15],
    ['pilarWeight', 'Peso mínimo en pilares (%)', 70],
    ['smallWeight', 'Peso máximo en Micro/Small/Mid Caps (%)', 10],
    ['maxWeight', 'Peso máximo de la principal posición (%)', 15],
    ['lossAlert', 'Alerta de pérdidas a partir de (%)', -10],
  ];
  const [v, setV] = useState(() => Object.fromEntries(fields.map(([k, , d]) => [k, rules[k] != null ? String(rules[k] * 100) : String(d)])));
  return (
    <Modal title="Referencias del análisis" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={() => {
        onSave({ ...rules, ...Object.fromEntries(fields.map(([k]) => [k, parseAmount(v[k]) / 100])) });
        onClose();
      }}>Guardar</button></>}>
      <div className="stack">
        {fields.map(([k, l]) => (
          <Field key={k} label={l}><input className="input" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>
        ))}
      </div>
    </Modal>
  );
}

/** Pestaña "Seguimiento": precio objetivo a 5 años y rango 52 semanas. */
function Seguimiento() {
  const { update } = useStore();
  const { portfolio: pf } = useMarket();
  const rows = pf.assets.filter((a) => a.symbol && a.price != null && a.type !== 'Efectivo');

  function setTarget(asset, val) {
    const n = val === '' ? null : parseAmount(val);
    const ids = new Set(asset.positions.map((p) => p.id));
    update((s) => ({ ...s, positions: s.positions.map((p) => (ids.has(p.id) ? { ...p, target5y: n } : p)) }));
  }

  return (
    <div className="card">
      <div className="card-head"><h2>Seguimiento</h2><MarketStatus /></div>
      {rows.length === 0 ? <Empty>Añade posiciones con ticker para hacer seguimiento.</Empty> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Empresa</th><th className="num">Precio actual</th><th className="num">Precio objetivo a 5 años</th>
                <th className="num">Retorno anual esperado</th><th className="num">Desde máx. 52s</th><th style={{ minWidth: 180 }}>Cotización últimas 52 semanas</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].sort((a, b) => (b.expectedCagr ?? -9) - (a.expectedCagr ?? -9)).map((a) => (
                <tr key={a.key}>
                  <td><div className="asset-cell"><AssetLogo symbol={a.symbol} name={a.name} /><div><div className="name">{a.name}</div><div className="sym">{a.symbol}</div></div></div></td>
                  <td className="num">{num(a.price, 2)} {a.quoteCurrency}</td>
                  <td className="num">
                    <input className="cell" inputMode="decimal" key={`${a.key}-${a.target5y}`} defaultValue={a.target5y != null ? num(a.target5y, 2) : ''}
                      onBlur={(e) => setTarget(a, e.target.value)} aria-label={`Precio objetivo ${a.name}`} />
                  </td>
                  <td className={`num ${tone(a.expectedCagr)}`}><b>{pct(a.expectedCagr, 1, true)}</b></td>
                  <td className={`num ${tone(a.drawdown52)}`}>{pct(a.drawdown52, 1)}</td>
                  <td>
                    {a.range52 != null ? (
                      <div title={`Mín. ${num(a.quote.low52, 2)} · Máx. ${num(a.quote.high52, 2)}`}>
                        <div className="bar"><i style={{ width: `${a.range52 * 100}%` }} /></div>
                        <div className="small muted row" style={{ marginTop: 3 }}>
                          <span>{num(a.quote.low52, 0)}</span><span className="spacer" /><span>{pct(a.range52, 0)}</span><span className="spacer" /><span>{num(a.quote.high52, 0)}</span>
                        </div>
                      </div>
                    ) : <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 10 }}>Retorno anual esperado = (precio objetivo / precio actual)^(1/5) − 1. La barra indica dónde cotiza hoy dentro de su rango de 52 semanas (0% = mínimo, 100% = máximo).</p>
    </div>
  );
}

export default function Inversiones() {
  const { state } = useStore();
  const [tab, setTab] = useState('cartera');
  const [form, setForm] = useState(null);
  const [trade, setTrade] = useState(null);
  // Las filas calculadas llevan campos derivados: se edita siempre la posición guardada
  const raw = (p) => (p?.id ? state.positions.find((x) => x.id === p.id) || p : p);
  const onEdit = (p) => setForm(raw(p));
  const tabs = [['cartera', 'Cartera'], ['posiciones', 'Posiciones'], ['analisis', 'Análisis'], ['seguimiento', 'Seguimiento']];
  return (
    <>
      <div className="page-head">
        <div><h1>Inversiones</h1><div className="sub">Tu cartera en tiempo real</div></div>
      </div>
      <div className="tabs">
        {tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'cartera' && <Cartera onEditAsset={onEdit} />}
      {tab === 'posiciones' && <Posiciones onEdit={onEdit} onTrade={(p) => setTrade(raw(p))} />}
      {tab === 'analisis' && <Analisis />}
      {tab === 'seguimiento' && <Seguimiento />}
      {form && <PositionForm item={form.id ? form : null} brokerId={form.brokerId} onClose={() => setForm(null)} />}
      {trade && <TradeForm item={trade} onClose={() => setTrade(null)} />}
    </>
  );
}
