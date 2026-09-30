import { useState } from 'react';
import { merchantOf, domainForAsset } from '../lib/merchants.js';

// Iconos de línea al estilo SF Symbols (trazo 1.6, extremos redondeados).
const P = {
  // Navegación
  resumen: <><path d="M3.5 10.5 12 4l8.5 6.5" /><path d="M5.5 9v10.5h13V9" /><path d="M10 19.5v-5.5h4v5.5" /></>,
  movimientos: <><path d="M7 4v16" /><path d="m3.5 7.5 3.5-3.5 3.5 3.5" /><path d="M17 20V4" /><path d="m13.5 16.5 3.5 3.5 3.5-3.5" /></>,
  presupuestos: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  fijos: <><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7" /><path d="M20 4v4.7h-4.7" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.3" /><path d="M4 20v-4.7h4.7" /></>,
  inversiones: <><path d="M3.5 20.5h17" /><path d="m4 16 5-5 3.5 3.5L20 7" /><path d="M15.5 7H20v4.5" /></>,
  ajustes: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" /><circle cx="12" cy="12" r="6.5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,

  // Categorías
  cart: <><path d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6" /><circle cx="9.5" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></>,
  fork: <><path d="M7 3v7a2 2 0 0 0 2 2v9" /><path d="M11 3v7a2 2 0 0 1-2 2" /><path d="M9 3v5" /><path d="M17 21V3c-2.2 1.2-3.2 3.6-3.2 6.5V13H17" /></>,
  house: <><path d="M3.5 10.5 12 4l8.5 6.5" /><path d="M5.5 9v11h13V9" /><path d="M10 20v-5.5h4V20" /></>,
  bolt: <><path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8z" /></>,
  car: <><path d="M4 16.5V12l2-5.2A1.5 1.5 0 0 1 7.4 6h9.2a1.5 1.5 0 0 1 1.4.8L20 12v4.5" /><path d="M3 12h18v4.5H3z" /><path d="M5.5 16.5v2M18.5 16.5v2" /><circle cx="7.5" cy="14.2" r=".6" /><circle cx="16.5" cy="14.2" r=".6" /></>,
  fuel: <><path d="M5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 1 14 5v15.5" /><path d="M3.5 20.5h12" /><path d="M5 10h9" /><path d="M14 8.5h2a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 0 3 0V8l-2.5-3" /></>,
  ticket: <><path d="M3.5 8.5V6a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v2.5a2.5 2.5 0 0 0 0 5V16a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-2.5a2.5 2.5 0 0 0 0-5z" /><path d="M14.5 5v12" strokeDasharray="1.6 2" /></>,
  tshirt: <><path d="M8.5 3.5 3.5 6l1.8 4.2 2.2-.9V20.5h9V9.3l2.2.9L20.5 6l-5-2.5a3.5 3.5 0 0 1-7 0z" /></>,
  health: <><path d="M12 20.5s-8-4.6-8-10.6A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.9c0 6-8 10.6-8 10.6z" /><path d="M12 10.5v5M9.5 13h5" /></>,
  drop: <><path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z" /><path d="M9.2 14.5a2.8 2.8 0 0 0 2.8 2.8" /></>,
  dumbbell: <><path d="M6.5 7v10M17.5 7v10M4 9.5v5M20 9.5v5M6.5 12h11" /></>,
  repeat: <><rect x="3.5" y="5" width="17" height="14" rx="3" /><path d="m10 9.2 5 2.8-5 2.8z" /></>,
  wifi: <><path d="M3 9.5a13 13 0 0 1 18 0" /><path d="M6 12.8a8.5 8.5 0 0 1 12 0" /><path d="M9 16a4 4 0 0 1 6 0" /><circle cx="12" cy="19" r=".8" /></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.1 7.5 9.5 4.3-1.4 7.5-4.9 7.5-9.5V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  sofa: <><path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" /><path d="M3 12.5a1.5 1.5 0 0 1 3 0V14h12v-1.5a1.5 1.5 0 0 1 3 0V18H3z" /><path d="M5 18v2M19 18v2" /></>,
  laptop: <><rect x="4.5" y="5" width="15" height="10.5" rx="1.5" /><path d="M2.5 19h19" /></>,
  airplane: <><path d="M21 4.5 3.5 11l6 2 2 6z" /><path d="m9.5 13 5-4.5" /></>,
  gift: <><rect x="3.5" y="8.5" width="17" height="4" rx="1" /><path d="M5 12.5v8h14v-8M12 8.5v12" /><path d="M12 8.5C10.5 5 7 5 7 7s3 1.5 5 1.5zM12 8.5c1.5-3.5 5-3.5 5-1.5s-3 1.5-5 1.5z" /></>,
  book: <><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z" /><path d="M12 6.5v13" /></>,
  paw: <><circle cx="7" cy="10" r="1.8" /><circle cx="10.2" cy="6.3" r="1.8" /><circle cx="13.8" cy="6.3" r="1.8" /><circle cx="17" cy="10" r="1.8" /><path d="M12 11.5c-3 0-5 3.5-5 5.5 0 1.6 1.4 2.5 2.8 2.2 1-.2 1.5-.6 2.2-.6s1.2.4 2.2.6c1.4.3 2.8-.6 2.8-2.2 0-2-2-5.5-5-5.5z" /></>,
  bank: <><path d="M3.5 9 12 4l8.5 5z" /><path d="M5.5 9.5v7.5M9.8 9.5v7.5M14.2 9.5v7.5M18.5 9.5v7.5M3.5 20h17M4.5 17.5h15" /></>,
  doc: <><path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3.5V8h4.5M8.5 12.5h7M8.5 16h7" /></>,
  box: <><path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2z" /><path d="m4 7.2 8 4.3 8-4.3M12 11.5V21" /></>,
  briefcase: <><rect x="3.5" y="7" width="17" height="12.5" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" /></>,
  sparkles: <><path d="M10 4.5 11.6 9l4.4 1.5-4.4 1.6L10 16.5l-1.6-4.4L4 10.5 8.4 9z" /><path d="M17.5 3.5v3M16 5h3M17.5 15.5v4M15.5 17.5h4" /></>,
  chart: <><path d="M4 20.5h16" /><path d="M6.5 17v-4M11 17V8.5M15.5 17v-6M20 17V5.5" /></>,
  banknote: <><rect x="2.5" y="6.5" width="19" height="11" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 10v4M18 10v4" /></>,
  cup: <><path d="M5 8.5h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" /><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2M11 3.5v2M14 3.5v2" /></>,
  bag: <><path d="M5 8h14l-1 12.5H6z" /><path d="M9 10V6.5a3 3 0 0 1 6 0V10" /></>,
  tram: <><rect x="5.5" y="4.5" width="13" height="13" rx="3" /><path d="M5.5 11.5h13M9 20.5l1.5-3M15 20.5l-1.5-3" /><circle cx="9" cy="14.5" r=".6" /><circle cx="15" cy="14.5" r=".6" /></>,
  baby: <><circle cx="12" cy="12" r="8.5" /><circle cx="9.3" cy="11" r=".7" /><circle cx="14.7" cy="11" r=".7" /><path d="M9.5 15a3.5 3.5 0 0 0 5 0M12 3.5c-1 1.2-1 2.5 0 3.5" /></>,
  film: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M7.5 5v14M16.5 5v14M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4" /></>,
  music: <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  game: <><path d="M7 8h10a4 4 0 0 1 4 4.5l-.5 3.3a2.2 2.2 0 0 1-3.9 1L15 15H9l-1.6 1.8a2.2 2.2 0 0 1-3.9-1L3 12.5A4 4 0 0 1 7 8z" /><path d="M7.5 10.5v3M6 12h3" /><circle cx="15.5" cy="11" r=".6" /><circle cx="17" cy="13" r=".6" /></>,
  scissors: <><circle cx="6.5" cy="7" r="2.5" /><circle cx="6.5" cy="17" r="2.5" /><path d="M8.5 8.5 20 17M8.5 15.5 20 7" /></>,
  pie: <><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z" /><path d="M14.5 2.8v6.7h6.7a6.7 6.7 0 0 0-6.7-6.7z" /></>,
  trend: <><path d="M3.5 20.5h17" /><path d="m4 16 5-5 3.5 3.5L20 7" /><path d="M15.5 7H20v4.5" /></>,
  coins: <><ellipse cx="9" cy="7" rx="5.5" ry="2.5" /><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5M3.5 11v4c0 1.4 2.5 2.5 5.5 2.5" /><ellipse cx="15" cy="13" rx="5.5" ry="2.5" /><path d="M9.5 13v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4" /></>,
  piggy: <><path d="M5 11.5C5 8.5 8 6.5 12 6.5c1.3 0 2.5.2 3.5.6L18 5.5v3.2c.9.7 1.5 1.6 1.8 2.8h1.2v3.5h-1.4c-.5 1-1.3 1.8-2.3 2.4v2.1h-2.8v-1.3c-.8.2-1.6.3-2.5.3s-1.7-.1-2.5-.3v1.3H6.7v-2.2C5.6 16.4 5 14.8 5 11.5z" /><circle cx="15.5" cy="10.5" r=".6" /><path d="M5 11.5c-1.2 0-2-.8-2-2" /></>,
  graduation: <><path d="M2.5 9.5 12 5l9.5 4.5L12 14z" /><path d="M6.5 11.5V16c1.5 1.5 3.5 2.3 5.5 2.3s4-.8 5.5-2.3v-4.5M21.5 9.5V15" /></>,
};

export function Icon({ name, size = 20, strokeWidth = 1.6 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}

// Glifos disponibles para categorías y su color (ranura de la paleta validada)
export const CATEGORY_GLYPHS = {
  cart: 3, fork: 2, cup: 2, house: 1, bolt: 4, car: 1, fuel: 8, tram: 1, ticket: 7, film: 7, music: 5, game: 7,
  tshirt: 5, bag: 5, health: 8, drop: 5, scissors: 5, dumbbell: 6, repeat: 7, wifi: 1, shield: 3, sofa: 4, laptop: 1,
  airplane: 3, gift: 8, book: 4, graduation: 4, paw: 2, baby: 5, bank: 1, doc: 4, box: 1,
  briefcase: 6, sparkles: 4, chart: 6, banknote: 6, pie: 1, trend: 6, coins: 4, piggy: 5,
};

/** Icono de categoría: glifo sobre un cuadrado con el color de la categoría. */
export function CategoryIcon({ cat, size = 38 }) {
  const glyph = cat?.icon;
  const slot = CATEGORY_GLYPHS[glyph];
  if (!slot) {
    // Categoría personalizada con emoji o sin icono
    return <span className="cat-ico" style={{ width: size, height: size, fontSize: size * 0.46 }}>{glyph || '•'}</span>;
  }
  return (
    <span className="cat-ico" style={{ width: size, height: size, '--c': `var(--s${slot})` }}>
      <Icon name={glyph} size={size * 0.55} strokeWidth={1.7} />
    </span>
  );
}

/** Logo de una marca (vía /api/logo). Si no hay logo, muestra `fallback`. */
export function Logo({ domain, size = 38, fallback = null, title }) {
  const [failed, setFailed] = useState(null);
  if (!domain || failed === domain) return fallback;
  return (
    <span className="logo" style={{ width: size, height: size }} title={title}>
      <img src={`/api/logo?d=${encodeURIComponent(domain)}`} alt="" loading="lazy" decoding="async"
        onError={() => setFailed(domain)} />
    </span>
  );
}

/** Avatar de un movimiento o recurrente: logo del comercio o icono de la categoría. */
export function TxAvatar({ item, cat, size = 38 }) {
  const fb = <CategoryIcon cat={cat} size={size} />;
  // Web indicada a mano (p. ej. la empresa de la nómina) o comercio del catálogo
  if (item?.domain) return <Logo domain={item.domain} size={size} fallback={fb} title={item.payer || item.note || item.name} />;
  const m = merchantOf(item);
  return m?.domain ? <Logo domain={m.domain} size={size} fallback={fb} title={m.name} /> : fb;
}

/** Logo de una empresa de la cartera, con monograma si no se encuentra. */
export function AssetLogo({ symbol, name, size = 30 }) {
  const initials = String(name || symbol || '?').replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const fb = <span className="monogram" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials || '?'}</span>;
  return <Logo domain={domainForAsset({ symbol, name })} size={size} fallback={fb} title={name} />;
}
