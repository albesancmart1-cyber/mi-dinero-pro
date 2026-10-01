import { useEffect } from 'react';

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, full, hint }) {
  return (
    <label className={`field${full ? ' full' : ''}`}>
      {label}
      {children}
      {hint && <span className="muted small">{hint}</span>}
    </label>
  );
}

export function Stat({ label, value, delta, deltaClass = '' }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value tnum">{value}</div>
      {delta != null && <div className={`delta ${deltaClass}`}>{delta}</div>}
    </div>
  );
}

export function Seg({ value, onChange, options, big, small }) {
  return (
    <div className={`seg${big ? ' big' : ''}${small ? ' sm' : ''}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`${value === o.value ? 'on' : ''} ${o.className || ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Barra de progreso. `goal`: llegar al 100% es bueno (ingresos, inversión);
 * si no, es un límite (gastos) y pasarse se marca en rojo.
 */
export function Progress({ ratio, mark, goal = false }) {
  const r = ratio == null ? 0 : Math.max(0, ratio);
  const cls = goal ? (r >= 1 ? 'done' : '') : r > 1 ? 'over' : r > 0.85 ? 'warn' : '';
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(r * 100)} aria-valuemin={0} aria-valuemax={100}>
      <i className={cls} style={{ width: `${Math.min(100, r * 100)}%` }} />
      {mark != null && <span className="mark" style={{ left: `calc(${Math.min(100, mark * 100)}% - 1px)` }} />}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}
