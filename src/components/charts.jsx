import { useMemo, useRef, useState } from 'react';

export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];

function niceTicks(min, max, count = 4) {
  if (max === min) { max = min + 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });

/**
 * Donut con leyenda. items: [{ label, value, color, sub }]
 * El color lo decide quien llama (sigue a la entidad, no al rango).
 */
export function Donut({ items, size = 168, center, format = (v) => v }) {
  const [hover, setHover] = useState(null);
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  const r = size / 2 - 4;
  const inner = r * 0.64;
  let a0 = -Math.PI / 2;
  const gap = items.length > 1 ? 0.012 : 0;
  const arcs = items.map((it, idx) => {
    const frac = total > 0 ? Math.max(0, it.value) / total : 0;
    const a1 = a0 + frac * Math.PI * 2;
    const s = a0 + gap, e = Math.max(s, a1 - gap);
    a0 = a1;
    const large = e - s > Math.PI ? 1 : 0;
    const c = size / 2;
    const p = (ang, rad) => `${c + rad * Math.cos(ang)} ${c + rad * Math.sin(ang)}`;
    const d = frac >= 0.9999
      ? `M ${p(-Math.PI / 2, r)} A ${r} ${r} 0 1 1 ${p(Math.PI * 1.5 - 0.0001, r)} L ${p(Math.PI * 1.5 - 0.0001, inner)} A ${inner} ${inner} 0 1 0 ${p(-Math.PI / 2, inner)} Z`
      : `M ${p(s, r)} A ${r} ${r} 0 ${large} 1 ${p(e, r)} L ${p(e, inner)} A ${inner} ${inner} 0 ${large} 0 ${p(s, inner)} Z`;
    return { d, it, idx, frac };
  });
  const h = hover != null ? items[hover] : null;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribución">
        {arcs.map((a) => (
          <path
            key={a.idx}
            d={a.d}
            fill={a.it.color}
            opacity={hover == null || hover === a.idx ? 1 : 0.35}
            onMouseEnter={() => setHover(a.idx)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${a.it.label}: ${format(a.it.value)} (${(a.frac * 100).toFixed(1)}%)`}</title>
          </path>
        ))}
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" style={{ fill: 'var(--ink)', fontSize: 15, fontWeight: 650 }}>
          {h ? `${((h.value / total) * 100).toFixed(1)}%` : center?.[0]}
        </text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: 11 }}>
          {h ? h.label.slice(0, 18) : center?.[1]}
        </text>
      </svg>
      <div className="donut-legend">
        {items.map((it, i) => (
          <div className="r" key={it.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: it.color, display: 'inline-block' }} />
            <span>{it.label}</span>
            <span className="tnum">{total > 0 ? ((it.value / total) * 100).toFixed(1) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Gráfico de líneas con cruceta y tooltip.
 * series: [{ key, label, color }], data: [{ x: 'YYYY-MM-DD', [key]: number }]
 */
export function LineChart({ data, series, height = 220, format = (v) => v, xLabel = (x) => x }) {
  const ref = useRef(null);
  const [hi, setHi] = useState(null);
  const W = 640, H = height, L = 48, R = 12, T = 10, B = 26;
  const { ticks, xs, ys } = useMemo(() => {
    const vals = data.flatMap((d) => series.map((s) => d[s.key]).filter((v) => v != null));
    const min = Math.min(...vals), max = Math.max(...vals);
    const pad = (max - min) * 0.08 || Math.abs(max) * 0.05 || 1;
    const ticks = niceTicks(min - pad, max + pad);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const xs = (i) => L + (data.length > 1 ? (i / (data.length - 1)) * (W - L - R) : (W - L - R) / 2);
    const ys = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    return { ticks, xs, ys };
  }, [data, series, H]);

  if (!data.length) return null;

  const onMove = (e) => {
    const box = ref.current.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((x - L) / (W - L - R)) * (data.length - 1));
    setHi(Math.max(0, Math.min(data.length - 1, i)));
  };

  const labelIdx = data.length <= 6 ? data.map((_, i) => i) : [0, Math.floor(data.length / 2), data.length - 1];
  const hp = hi != null ? data[hi] : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHi(null)} role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={L} x2={W - R} y1={ys(t)} y2={ys(t)} />
            <text x={L - 6} y={ys(t) + 4} textAnchor="end">{compact.format(t)}</text>
          </g>
        ))}
        {labelIdx.map((i) => (
          <text key={i} x={xs(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>
            {xLabel(data[i].x)}
          </text>
        ))}
        {series.map((s) => {
          const pts = data.map((d, i) => (d[s.key] != null ? `${xs(i)},${ys(d[s.key])}` : null)).filter(Boolean);
          return (
            <polyline key={s.key} points={pts.join(' ')} fill="none" stroke={s.color} strokeWidth={2}
              strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
          );
        })}
        {hp && (
          <g>
            <line x1={xs(hi)} x2={xs(hi)} y1={T} y2={H - B} stroke="var(--axis)" />
            {series.map((s) => hp[s.key] != null && (
              <circle key={s.key} cx={xs(hi)} cy={ys(hp[s.key])} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hp && (
        <div className="tooltip" style={{
          left: `${(xs(hi) / W) * 100}%`, top: 0,
          transform: `translateX(${xs(hi) > W * 0.6 ? 'calc(-100% - 10px)' : '10px'})`,
        }}>
          <div className="muted">{xLabel(hp.x, true)}</div>
          {series.map((s) => (
            <div key={s.key}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: s.color, marginRight: 6 }} />
              {s.label}: <b>{format(hp[s.key])}</b></div>
          ))}
        </div>
      )}
      {series.length > 1 && (
        <div className="legend" style={{ marginTop: 8 }}>
          {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
        </div>
      )}
    </div>
  );
}

/** Barras agrupadas (p. ej. ingresos vs gastos por mes). */
export function GroupedBars({ data, series, height = 200, format = (v) => v, xLabel = (x) => x }) {
  const [hi, setHi] = useState(null);
  const W = 640, H = height, L = 48, R = 8, T = 10, B = 26;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] || 0)));
  const ticks = niceTicks(0, max);
  const top = ticks[ticks.length - 1];
  const ys = (v) => T + (1 - v / top) * (H - T - B);
  const bw = (W - L - R) / data.length;
  const barW = Math.min(22, (bw * 0.7) / series.length);
  const hp = hi != null ? data[hi] : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" onMouseLeave={() => setHi(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'base-line' : 'grid-line'} x1={L} x2={W - R} y1={ys(t)} y2={ys(t)} />
            <text x={L - 6} y={ys(t) + 4} textAnchor="end">{compact.format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = L + bw * i + bw / 2;
          const x0 = cx - (barW * series.length + 2 * (series.length - 1)) / 2;
          return (
            <g key={d.x} onMouseEnter={() => setHi(i)}>
              <rect x={L + bw * i} y={T} width={bw} height={H - T - B} fill={hi === i ? 'var(--surface-2)' : 'transparent'} />
              {series.map((s, j) => {
                const v = d[s.key] || 0;
                const y = ys(v);
                const h = Math.max(0, ys(0) - y);
                const x = x0 + j * (barW + 2);
                const rr = Math.min(4, h, barW / 2);
                return (
                  <path key={s.key} fill={s.color}
                    d={`M ${x} ${ys(0)} V ${y + rr} Q ${x} ${y} ${x + rr} ${y} H ${x + barW - rr} Q ${x + barW} ${y} ${x + barW} ${y + rr} V ${ys(0)} Z`} />
                );
              })}
              <text x={cx} y={H - 6} textAnchor="middle">{xLabel(d.x)}</text>
            </g>
          );
        })}
      </svg>
      {hp && (
        <div className="tooltip" style={{
          left: `${((L + bw * hi + bw / 2) / W) * 100}%`, top: 0,
          transform: `translateX(${hi > data.length / 2 ? 'calc(-100% - 12px)' : '12px'})`,
        }}>
          <div className="muted">{xLabel(hp.x, true)}</div>
          {series.map((s) => (
            <div key={s.key}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: s.color, marginRight: 6 }} />
              {s.label}: <b>{format(hp[s.key] || 0)}</b></div>
          ))}
        </div>
      )}
      <div className="legend" style={{ marginTop: 8 }}>
        {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
      </div>
    </div>
  );
}
