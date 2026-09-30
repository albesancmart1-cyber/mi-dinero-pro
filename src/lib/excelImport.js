// Importación del Excel CARTERA.xlsx (hojas Broker1..5, Cartera, Seguimiento, Activos).
import { uid } from './defaults.js';
import { ASSET_TYPES } from './portfolio.js';

// Tickers de Yahoo para nombres habituales del Excel (el resto se busca).
const KNOWN = {
  'MICROSOFT CORPORATION': 'MSFT', 'META PLATFORMS, INC.': 'META', 'CONSTELLATION SOFTWARE INC.': 'CSU.TO',
  'AMAZON.COM, INC.': 'AMZN', 'NVIDIA CORPORATION': 'NVDA', 'ALPHABET INC.': 'GOOGL', 'APPLE INC.': 'AAPL',
  'TAIWAN SEMICONDUCTOR MANUFACTURING COMPANY LIMITED': '2330.TW', 'VISA INC.': 'V', 'MASTERCARD INCORPORATED': 'MA',
  'BITCOIN': 'BTC-EUR', 'ASML HOLDING N.V.': 'ASML.AS', 'BERKSHIRE HATHAWAY INC.': 'BRK-B', 'COSTCO WHOLESALE CORPORATION': 'COST',
  'FERRARI N.V.': 'RACE.MI', 'HERMES INTERNATIONAL SCA': 'RMS.PA', 'LVMH MOET HENNESSY LOUIS VUITTON SE': 'MC.PA',
  'NESTLE LTD.': 'NESN.SW', 'AMERICAN EXPRESS COMPANY': 'AXP', 'STATE STREET SPDR S&P500': 'SPY',
  'INDUSTRIA DE DISENO TEXTIL SA': 'ITX.MC', 'IBERDROLA, S.A.': 'IBE.MC', 'BANCO SANTANDER S.A.': 'SAN.MC',
};
const NO_TICKER = new Set(['EFECTIVO', 'BONOS', 'ORO', 'FONDO INDEXADO S&P 500', 'FONDO INDEXADO NASDAQ 100']);
const MANUAL = ['Fondos', 'Bonos', 'Efectivo', 'Otros'];

function cell(ws, addr) {
  const c = ws?.[addr];
  return c ? c.v : undefined;
}

/**
 * Lee el Excel CARTERA.xlsx. `XLSX` es el módulo SheetJS (se inyecta para
 * cargarlo bajo demanda en el navegador) y `search` resuelve tickers.
 */
export async function parseWorkbook(XLSX, buffer, search) {
  const wb = XLSX.read(buffer, { type: 'array' });
  const up = (s) => String(s || '').trim().toUpperCase();

  // Hoja Activos: divisa, beta y tipo por nombre
  const activos = {};
  const wa = wb.Sheets.Activos;
  if (wa) {
    for (let r = 2; r < 1000; r++) {
      const n = cell(wa, `B${r}`);
      if (!n) continue;
      activos[up(n)] = { currency: cell(wa, `D${r}`), beta: cell(wa, `E${r}`), type: cell(wa, `I${r}`) };
    }
  }
  // Hoja Cartera: % deseado y objetivo
  const wc = wb.Sheets.Cartera;
  const target = {};
  if (wc) for (let r = 10; r < 600; r++) {
    const n = cell(wc, `B${r}`);
    const w = cell(wc, `I${r}`);
    if (n && typeof w === 'number') target[up(n)] = w;
  }
  // Hoja Seguimiento: precio objetivo a 5 años
  const ws5 = wb.Sheets.Seguimiento;
  const target5 = {};
  if (ws5) for (let r = 3; r < 300; r++) {
    const n = cell(ws5, `B${r}`);
    const t = cell(ws5, `D${r}`);
    if (n && typeof t === 'number') target5[up(n)] = t;
  }

  const brokers = [];
  const rows = [];
  for (const name of wb.SheetNames.filter((s) => /^Broker\d+$/i.test(s))) {
    const w = wb.Sheets[name];
    const items = [];
    for (let r = 10; r < 1500; r++) {
      const n = cell(w, `B${r}`);
      if (!n || typeof n !== 'string') continue;
      const qty = cell(w, `C${r}`);
      const avg = cell(w, `D${r}`);
      const a = activos[up(n)] || {};
      const type = ASSET_TYPES.includes(cell(w, `N${r}`)) ? cell(w, `N${r}`) : ASSET_TYPES.includes(a.type) ? a.type : 'Otros';
      items.push({ name: n.trim(), qty: typeof qty === 'number' ? qty : null, avg: typeof avg === 'number' ? avg : null, type, activo: a });
    }
    if (!items.length) continue;
    const id = uid();
    brokers.push({ id, name: String(cell(w, 'C2') || name), currency: String(cell(w, 'C3') || 'EUR') });
    items.forEach((it) => rows.push({ ...it, brokerId: id }));
  }

  const resolved = await Promise.all(rows.map(async (it) => {
    const key = up(it.name);
    let symbol = KNOWN[key] || '';
    if (!symbol && !NO_TICKER.has(key) && !(MANUAL.includes(it.type) && it.qty == null)) {
      try {
        const res = await search(it.name);
        symbol = (res.find((x) => x.type === 'EQUITY' || x.type === 'ETF') || res[0])?.symbol || '';
      } catch { /* sin conexión */ }
    }
    return {
      id: uid(),
      brokerId: it.brokerId,
      name: it.name,
      symbol,
      type: it.type,
      qty: it.qty ?? 0,
      avgPrice: it.avg ?? 0,
      quoteCurrency: it.activo.currency || null,
      beta: typeof it.activo.beta === 'number' ? it.activo.beta : null,
      targetWeight: target[key] ?? null,
      target5y: target5[key] ?? null,
    };
  }));

  return {
    brokers,
    positions: resolved,
    targetAmount: typeof cell(wc, 'G4') === 'number' ? cell(wc, 'G4') : null,
    currency: cell(wc, 'C3') || null,
  };
}

/** Convierte las filas sin ticker al formato manual (avgPrice = total invertido). */
export function finalize(p) {
  if (p.symbol) return p;
  const total = p.qty ? p.qty * p.avgPrice : p.avgPrice;
  return { ...p, qty: null, avgPrice: total, manualValue: total };
}

