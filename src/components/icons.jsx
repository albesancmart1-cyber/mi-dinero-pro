// Iconos de línea al estilo SF Symbols (trazo 1.6, extremos redondeados).
const P = {
  resumen: <><path d="M3.5 10.5 12 4l8.5 6.5" /><path d="M5.5 9v10.5h13V9" /><path d="M10 19.5v-5.5h4v5.5" /></>,
  movimientos: <><path d="M7 4v16" /><path d="m3.5 7.5 3.5-3.5 3.5 3.5" /><path d="M17 20V4" /><path d="m13.5 16.5 3.5 3.5 3.5-3.5" /></>,
  presupuestos: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  fijos: <><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7" /><path d="M20 4v4.7h-4.7" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.3" /><path d="M4 20v-4.7h4.7" /></>,
  inversiones: <><path d="M3.5 20.5h17" /><path d="m4 16 5-5 3.5 3.5L20 7" /><path d="M15.5 7H20v4.5" /></>,
  ajustes: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" /><circle cx="12" cy="12" r="6.5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
};

export function Icon({ name, size = 20, strokeWidth = 1.6 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}
