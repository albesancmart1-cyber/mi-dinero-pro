import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { usePortfolioHistory } from '../lib/historyClient.jsx';
import { PERIODS, brokerChartData, changeOver } from '../lib/history.js';
import { LineChart, SERIES } from './charts.jsx';
import { Empty, Seg } from './ui.jsx';
import { money, num, pct, signedMoney, tone } from '../lib/format.js';

const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });
const fmtDate = (ms, o) => new Date(ms).toLocaleString('es-ES', o);

/** Etiquetas del eje y del tooltip según el periodo (hora, día, mes…). */
export function xLabelFor(periodId) {
  return (x, long) => {
    switch (periodId) {
      case '1d': return long ? fmtDate(x, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : fmtDate(x, { hour: '2-digit', minute: '2-digit' });
      case '1w': return long ? fmtDate(x, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : fmtDate(x, { day: 'numeric', month: 'short' });
      case '5y': return long ? fmtDate(x, { day: 'numeric', month: 'short', year: 'numeric' }) : fmtDate(x, { month: 'short', year: '2-digit' });
      default: return long ? fmtDate(x, { day: 'numeric', month: 'short', year: 'numeric' }) : fmtDate(x, { day: 'numeric', month: 'short' });
    }
  };
}

export function PeriodTabs({ value, onChange }) {
  return <Seg small value={value} onChange={onChange} options={PERIODS.map((p) => ({ value: p.id, label: p.label }))} />;
}

function Status({ h }) {
  if (h.error) {
    return (
      <div className="alert crit" style={{ marginBottom: 10 }}>
        <span>No se pudo cargar el histórico ({h.error}).</span><span className="spacer" />
        <button className="btn sm" onClick={h.refresh}>Reintentar</button>
      </div>
    );
  }
  return null;
}

/** Cambio del periodo: "+1.234 € (+5,3 %)", en color y con signo. */
function Change({ ch, cur }) {
  if (ch.change == null) return null;
  return <span className={`evo-change ${tone(ch.change)}`}>{signedMoney(ch.change, cur)} ({pct(ch.pct, 2, true)})</span>;
}

export function PatrimonioCard({ h, period, setPeriod, fxMode, setFxMode, title = 'Evolución del patrimonio', cash = 0 }) {
  const { state } = useStore();
  const cur = state.settings.currency;
  const ch = changeOver(h.points, (p) => p.total);
  const data = h.points.map((p) => ({ x: p.t, total: p.total }));
  const last = h.points[h.points.length - 1];
  return (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>
      {!h.hasData ? <Empty>Añade posiciones en Inversiones para ver cómo evoluciona tu patrimonio.</Empty> : (
        <>
          <Status h={h} />
          <div className="evo-head">
            <div className="evo-value tnum">{last ? money(last.total, cur, 0) : '—'}</div>
            <div className="muted small">
              <Change ch={ch} cur={cur} /> · {h.period.title.toLowerCase()}
              {h.loading && ' · actualizando…'}
            </div>
          </div>
          {data.length >= 2 ? (
            <LineChart data={data} height={240} format={(v) => money(v, cur, 0)} xLabel={xLabelFor(period)}
              tickFormat={(v) => `${compact.format(v)}`}
              series={[{ key: 'total', label: 'Patrimonio', color: 'var(--s1)' }]} />
          ) : <Empty>{h.loading ? 'Cargando histórico…' : 'Sin datos suficientes para este periodo.'}</Empty>}
          <div className="row wrap" style={{ marginTop: 10 }}>
            <label className="check small">
              <input type="checkbox" checked={fxMode === 'historic'} onChange={(e) => setFxMode(e.target.checked ? 'historic' : 'current')} />
              Incluir el efecto del tipo de cambio
            </label>
          </div>
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            Valor en {cur} de tus posiciones actuales con el precio y el tipo de cambio de cada fecha
            {cash > 0 ? ', más el saldo de tus cuentas de hoy' : ''}. Solo refleja tus compras y ventas si las registraste con <b>Operar</b>.
            {fxMode === 'current' && ' Sin efecto divisa: se usa el tipo de cambio de hoy en todas las fechas, así ves solo lo que ha hecho el precio (como tu Excel).'}
          </p>
          {h.missing.length > 0 && <p className="small neg" style={{ margin: '6px 0 0' }}>Sin histórico para: {h.missing.join(', ')} (no se incluyen).</p>}
        </>
      )}
    </div>
  );
}

export function BrokerCard({ h }) {
  const { state } = useStore();
  const cur = state.settings.currency;
  const [mode, setMode] = useState('value');
  const nameOf = (id) => state.brokers.find((b) => b.id === id)?.name || id;
  const data = brokerChartData(h.points, h.brokerIds, mode);
  const series = [
    ...h.brokerIds.map((id, i) => ({ key: id, label: nameOf(id), color: SERIES[i % SERIES.length] })),
    ...(mode === 'pct' ? [{ key: 'total', label: 'Total cartera', color: 'var(--ink-2)', dashed: true }] : []),
  ];
  const rows = h.brokerIds.map((id) => ({ id, name: nameOf(id), ...changeOver(h.points, (p) => p.brokers[id]) }));
  const total = changeOver(h.points, (p) => p.assets);
  const pctFmt = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v), 2)} %`;
  return (
    <div className="card">
      <div className="card-head">
        <div><h2>Evolución por broker</h2><div className="small muted">{h.period.title}</div></div>
        <Seg small value={mode} onChange={setMode} options={[{ value: 'value', label: 'Valor' }, { value: 'pct', label: 'Variación %' }]} />
      </div>
      {!h.hasData || !h.brokerIds.length ? <Empty>Sin datos de brokers para este periodo.</Empty> : (
        <>
          {data.length >= 2 ? (
            <LineChart data={data} height={240} series={series} xLabel={xLabelFor(h.period.id)}
              format={(v) => (mode === 'pct' ? pctFmt(v) : money(v, cur, 0))}
              tickFormat={(v) => (mode === 'pct' ? `${num(v, 1)} %` : compact.format(v))} />
          ) : <Empty>{h.loading ? 'Cargando histórico…' : 'Sin datos suficientes para este periodo.'}</Empty>}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="tbl">
              <thead><tr><th>Broker</th><th className="num">Valor actual</th><th className="num">Cambio</th><th className="num">Variación</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td><span className="row"><i className="swatch" style={{ background: SERIES[i % SERIES.length] }} />{r.name}</span></td>
                    <td className="num">{money(r.last, cur, 0)}</td>
                    <td className={`num ${tone(r.change)}`}>{r.change == null ? '—' : signedMoney(r.change, cur)}</td>
                    <td className={`num ${tone(r.change)}`}>{r.pct == null ? '—' : pctFmt(r.pct * 100)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td>Total</td><td className="num">{money(total.last, cur, 0)}</td>
                  <td className={`num ${tone(total.change)}`}>{total.change == null ? '—' : signedMoney(total.change, cur)}</td>
                  <td className={`num ${tone(total.change)}`}>{total.pct == null ? '—' : pctFmt(total.pct * 100)}</td></tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/** Patrimonio total (con cuentas opcionales): usado en el Resumen. */
export function PatrimonioEvolution({ cash = 0, defaultPeriod = '1m', title }) {
  const [period, setPeriod] = useState(defaultPeriod);
  const [fxMode, setFxMode] = useState('historic');
  const h = usePortfolioHistory(period, { fxMode, cash });
  return <PatrimonioCard h={h} period={period} setPeriod={setPeriod} fxMode={fxMode} setFxMode={setFxMode} title={title} cash={cash} />;
}

/** Patrimonio de la cartera + por broker, con el mismo periodo: usado en Inversiones. */
export function EvolutionSection() {
  const [period, setPeriod] = useState('1m');
  const [fxMode, setFxMode] = useState('historic');
  const h = usePortfolioHistory(period, { fxMode });
  return (
    <div className="stack" style={{ gap: 16, marginBottom: 16 }}>
      <PatrimonioCard h={h} period={period} setPeriod={setPeriod} fxMode={fxMode} setFxMode={setFxMode} title="Evolución del patrimonio invertido" />
      <BrokerCard h={h} />
    </div>
  );
}
