const cache = new Map();

function nf(opts) {
  const k = JSON.stringify(opts);
  if (!cache.has(k)) cache.set(k, new Intl.NumberFormat('es-ES', opts));
  return cache.get(k);
}

export function money(x, currency = 'EUR', decimals = 2) {
  if (x == null || Number.isNaN(x)) return '—';
  return nf({ style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(x);
}

export function num(x, decimals = 2) {
  if (x == null || Number.isNaN(x)) return '—';
  return nf({ minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(x);
}

export function pct(x, decimals = 1, signed = false) {
  if (x == null || Number.isNaN(x)) return '—';
  const s = nf({ style: 'percent', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(x);
  return signed && x > 0 ? `+${s}` : s;
}

export function signedMoney(x, currency = 'EUR') {
  if (x == null || Number.isNaN(x)) return '—';
  return (x > 0 ? '+' : '') + money(x, currency);
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function monthLabel(m, short = false) {
  const [y, mm] = m.split('-').map(Number);
  const name = MONTHS[mm - 1];
  return short ? `${name.slice(0, 3)} ${String(y).slice(2)}` : `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
}

export function dateLabel(d) {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${MONTHS[m - 1].slice(0, 3)}${y !== new Date().getFullYear() ? ` ${y}` : ''}`;
}

export function tone(x) {
  if (x == null || Number.isNaN(x) || Math.abs(x) < 1e-9) return '';
  return x > 0 ? 'pos' : 'neg';
}

/** Admite coma decimal española ("12,50"). */
export function parseAmount(s) {
  if (typeof s === 'number') return s;
  const t = String(s || '').trim().replace(/\s/g, '');
  if (!t) return NaN;
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(norm);
}
