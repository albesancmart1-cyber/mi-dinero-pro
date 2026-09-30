// Cálculos de cartera: réplica de la lógica del Excel CARTERA.xlsx
// (hojas Broker, Cartera, Análisis y Seguimiento). Funciones puras, sin DOM,
// compartidas entre el frontend y las funciones serverless (cron).

export const ASSET_TYPES = [
  'Pilares',
  'Large Caps',
  'Micro/Small/Mid Caps',
  'ETFs',
  'Fondos',
  'Bonos',
  'Efectivo',
  'Otros',
];

// Tipos que el Excel considera "empresas" (cuentan para nº de empresas y beta).
export const COMPANY_TYPES = ['Pilares', 'Large Caps', 'Micro/Small/Mid Caps'];

export const DEFAULT_RULES = {
  minCompanies: 10,
  maxCompanies: 15,
  maxWeight: 0.15, // Peso máximo de la principal posición
  minTopWeight: 0.1,
  pilarWeight: 0.7, // Peso mínimo en pilares
  smallWeight: 0.1, // Peso máximo en Micro/Small/Mid Caps
  cashWeight: 0.15, // Peso de efectivo de referencia
  lossAlert: -0.1, // Posiciones con pérdidas superiores a este %
};

/**
 * Una posición cotiza en mercado si tiene ticker. Si no (efectivo, fondos,
 * bonos u "otros" sin ticker), como en el Excel el "precio medio" es el
 * importe total invertido y el valor actual se introduce a mano.
 */
export function isMarketPosition(p) {
  return !!(p.symbol && String(p.symbol).trim());
}

/** Tipo de cambio para convertir 1 unidad de `from` a `to`. */
export function fxRate(fx, from, to) {
  if (!from || !to || from === to) return 1;
  const direct = fx?.[`${from}${to}`];
  if (direct > 0) return direct;
  const inverse = fx?.[`${to}${from}`];
  if (inverse > 0) return 1 / inverse;
  return null;
}

/**
 * Calcula una posición (una fila de la hoja Broker).
 * @param {object} p posición
 * @param {object} ctx { quotes, fx, currency, brokers }
 */
export function computePosition(p, ctx) {
  const { quotes = {}, fx = {}, currency = 'EUR', brokers = [] } = ctx;
  const broker = brokers.find((b) => b.id === p.brokerId);
  const brokerCcy = broker?.currency || currency;
  const qty = Number(p.qty) || 0;
  const avg = Number(p.avgPrice) || 0;

  if (isMarketPosition(p)) {
    const q = quotes[p.symbol];
    const ccy = q?.currency || p.quoteCurrency || brokerCcy;
    const price = q?.price ?? null;
    const rate = fxRate(fx, ccy, currency);
    const investedLocal = qty * avg;
    const valueLocal = price != null ? qty * price : null;
    const invested = rate != null ? investedLocal * rate : null;
    const value = rate != null && valueLocal != null ? valueLocal * rate : null;
    return {
      ...p,
      market: true,
      quoteCurrency: ccy,
      price,
      rate,
      investedLocal,
      valueLocal,
      invested,
      value,
      pnl: invested != null && value != null ? value - invested : null,
      returnPct: investedLocal > 0 && valueLocal != null ? valueLocal / investedLocal - 1 : null,
      dayChangePct: q?.changePct ?? null,
      quote: q || null,
    };
  }

  // Posición manual: avgPrice = total invertido (divisa del broker)
  const rate = fxRate(fx, brokerCcy, currency);
  const investedLocal = avg;
  const valueLocal = p.manualValue !== undefined && p.manualValue !== null && p.manualValue !== ''
    ? Number(p.manualValue)
    : avg;
  return {
    ...p,
    market: false,
    quoteCurrency: brokerCcy,
    price: null,
    rate,
    investedLocal,
    valueLocal,
    invested: rate != null ? investedLocal * rate : null,
    value: rate != null ? valueLocal * rate : null,
    pnl: rate != null ? (valueLocal - investedLocal) * rate : null,
    returnPct: investedLocal > 0 ? valueLocal / investedLocal - 1 : null,
    dayChangePct: null,
    quote: null,
  };
}

/** Clave de agrupación de activos entre brokers (hoja Cartera agrupa por nombre). */
function assetKey(p) {
  return (p.symbol ? `S:${p.symbol}` : `N:${(p.name || '').trim().toLowerCase()}`);
}

/**
 * Hoja "Cartera": agrupa posiciones de todos los brokers por activo.
 * @param {Array} positions
 * @param {object} ctx { quotes, fx, currency, brokers, targetAmount, targets }
 *   targets: { [assetKey]: { weight, target5y, beta } } — opcional; si no,
 *   se usan los campos de la propia posición.
 */
export function computePortfolio(positions, ctx) {
  const rows = positions.map((p) => computePosition(p, ctx));
  const groups = new Map();
  for (const r of rows) {
    const k = assetKey(r);
    if (!groups.has(k)) {
      groups.set(k, {
        key: k,
        name: r.name,
        symbol: r.symbol || '',
        type: r.type,
        quoteCurrency: r.quoteCurrency,
        price: r.price,
        quote: r.quote,
        qty: 0,
        investedLocal: 0,
        valueLocal: 0,
        invested: 0,
        value: 0,
        missing: false,
        targetWeight: null,
        target5y: null,
        beta: null,
        positions: [],
      });
    }
    const g = groups.get(k);
    g.positions.push(r);
    g.qty += Number(r.qty) || 0;
    g.investedLocal += r.investedLocal || 0;
    if (r.valueLocal != null) g.valueLocal += r.valueLocal;
    if (r.invested == null || r.value == null) g.missing = true;
    g.invested += r.invested || 0;
    g.value += r.value || 0;
    if (r.targetWeight != null && r.targetWeight !== '') g.targetWeight = Number(r.targetWeight);
    if (r.target5y != null && r.target5y !== '') g.target5y = Number(r.target5y);
    if (r.beta != null && r.beta !== '') g.beta = Number(r.beta);
  }

  const assets = [...groups.values()];
  const totalInvested = assets.reduce((s, a) => s + a.invested, 0);
  const totalValue = assets.reduce((s, a) => s + a.value, 0);
  const targetAmount = Number(ctx.targetAmount) || 0;

  for (const a of assets) {
    a.avgPrice = a.qty > 0 ? a.investedLocal / a.qty : null;
    a.returnPct = a.invested > 0 ? a.value / a.invested - 1 : null;
    a.pnl = a.value - a.invested;
    a.weight = totalValue > 0 ? a.value / totalValue : 0;
    // "Importe a comprar o (vender)": deseado*total - actual*total
    a.rebalance = a.targetWeight != null ? a.targetWeight * totalValue - a.value : null;
    // "Importe a comprar o (vender) OBJETIVO": ROUND(objetivo*deseado - actual)
    a.rebalanceTarget = a.targetWeight != null && targetAmount > 0
      ? Math.round(targetAmount * a.targetWeight - a.value)
      : null;
    // Seguimiento: retorno anual esperado a 5 años
    a.expectedCagr = a.target5y && a.price ? Math.pow(a.target5y / a.price, 1 / 5) - 1 : null;
    const hi = a.quote?.high52, lo = a.quote?.low52;
    a.range52 = a.price != null && hi != null && lo != null && hi > lo ? (a.price - lo) / (hi - lo) : null;
    a.drawdown52 = a.price != null && hi ? (a.price - hi) / hi : null;
  }

  assets.sort((x, y) => y.value - x.value);

  const dayChange = rows.reduce((s, r) => {
    if (r.dayChangePct == null || r.value == null) return s;
    const prev = r.value / (1 + r.dayChangePct);
    return s + (r.value - prev);
  }, 0);

  return {
    rows,
    assets,
    totalInvested,
    totalValue,
    pnl: totalValue - totalInvested,
    returnPct: totalInvested > 0 ? totalValue / totalInvested - 1 : null,
    dayChange,
    targetAmount,
    targetWeightSum: assets.reduce((s, a) => s + (a.targetWeight > 0 ? a.targetWeight : 0), 0),
    weightSum: assets.reduce((s, a) => s + (a.weight > 0 ? a.weight : 0), 0),
  };
}

function pct(x) {
  return `${Math.round(x * 100)}%`;
}

/** Hoja "Análisis" / "Calc": diagnóstico orientativo de la cartera. */
export function analyzePortfolio(pf, rules = DEFAULT_RULES, market = null) {
  const R = { ...DEFAULT_RULES, ...rules };
  const out = [];
  const companies = pf.assets.filter((a) => COMPANY_TYPES.includes(a.type) && a.weight > 0);
  const n = companies.length;

  // Nº de empresas
  out.push({
    id: 'companies',
    label: 'Nº de empresas en cartera',
    value: String(n),
    ref: `${R.minCompanies}–${R.maxCompanies}`,
    status: n >= R.minCompanies && n <= R.maxCompanies ? 'good' : 'warning',
    text: n >= R.minCompanies && n <= R.maxCompanies
      ? 'Posiciones de cartera adecuadas. Buena diversificación, permite un seguimiento correcto.'
      : n < R.minCompanies
        ? `Cartera demasiado concentrada, deberías considerar tener al menos ${R.minCompanies} posiciones en cartera.`
        : `Cartera demasiado diversificada, deberías considerar tener entre ${R.minCompanies} y ${R.maxCompanies} posiciones en cartera.`,
  });

  // Peso máximo
  const top = [...pf.assets].sort((a, b) => b.weight - a.weight)[0];
  if (top) {
    let status = 'good';
    let text = `Peso adecuado en tu principal posición, ${top.name}.`;
    if (top.type !== 'Pilares') {
      status = 'warning';
      text = `Tu principal posición, ${top.name}, no está considerada como una empresa pilar. ¿Estás seguro de que quieres tener tanto peso en ella?`;
    } else if (top.weight < R.minTopWeight) {
      status = 'warning';
      text = `Tienes poca exposición a tu principal posición, ${top.name}. Deberías plantearte aumentar esta posición hasta el ${pct(R.minTopWeight)}, como mínimo.`;
    } else if (top.weight > R.maxWeight) {
      status = 'serious';
      text = `Tienes una exposición elevada a tu principal posición, ${top.name}, superior al ${pct(R.maxWeight)}. Deberías plantearte reducirla.`;
    }
    out.push({ id: 'top', label: 'Peso máximo', value: pct(top.weight), ref: pct(R.maxWeight), status, text });
  }

  const sumType = (t) => pf.assets.filter((a) => a.type === t).reduce((s, a) => s + a.weight, 0);

  const pil = sumType('Pilares');
  out.push({
    id: 'pilares',
    label: 'Peso compañías pilares',
    value: pct(pil),
    ref: `> ${pct(R.pilarWeight)}`,
    status: pil > R.pilarWeight ? 'good' : 'warning',
    text: pil > R.pilarWeight
      ? 'Peso razonable en compañías pilares.'
      : `Exposición baja a compañías pilares. Deberías plantearte aumentar el peso de empresas pilares hasta el ${pct(R.pilarWeight)}–80%.`,
  });

  const small = sumType('Micro/Small/Mid Caps');
  out.push({
    id: 'small',
    label: 'Peso en Micro/Small/Mid Caps',
    value: pct(small),
    ref: `≤ ${pct(R.smallWeight)}`,
    status: small > R.smallWeight ? 'serious' : 'good',
    text: small > R.smallWeight
      ? `Exposición elevada a Micro/Small y/o Mid Caps. ¿Te sientes cómodo asumiendo tanto riesgo? Peso máximo para ser conservador: ${pct(R.smallWeight)}.`
      : `Peso razonable en Micro/Small y/o Mid Caps. Peso máximo para ser conservador: ${pct(R.smallWeight)}.`,
  });

  const cash = sumType('Efectivo');
  const cashDiff = cash - R.cashWeight;
  out.push({
    id: 'cash',
    label: 'Peso en efectivo',
    value: pct(cash),
    ref: pct(R.cashWeight),
    status: Math.abs(cashDiff) <= 0.02 ? 'good' : 'warning',
    text: Math.abs(cashDiff) <= 0.02
      ? 'Nivel de efectivo adecuado para el nivel actual de mercado.'
      : cashDiff < 0
        ? `Nivel de efectivo inferior al adecuado. Deberías plantearte aumentarlo hasta el ${pct(R.cashWeight)}.`
        : `Nivel de efectivo superior al adecuado. Deberías plantearte reducirlo hasta el ${pct(R.cashWeight)}.`,
  });

  // Beta ponderada (solo empresas con beta informada)
  const withBeta = companies.filter((a) => a.beta != null && !Number.isNaN(a.beta));
  const beta = withBeta.length ? withBeta.reduce((s, a) => s + a.beta * a.weight, 0) : null;

  // Posiciones en pérdidas
  const losers = pf.assets
    .filter((a) => a.returnPct != null && a.returnPct < 0 && a.invested > 0)
    .sort((a, b) => a.returnPct - b.returnPct)
    .map((a) => ({
      name: a.name,
      returnPct: a.returnPct,
      alert: a.returnPct < R.lossAlert,
    }));

  // Situación de mercado (S&P 500 vs máximo 52 semanas)
  let marketInfo = null;
  if (market?.price && market?.high52) {
    marketInfo = {
      price: market.price,
      high52: market.high52,
      drawdown: (market.price - market.high52) / market.high52,
    };
  }

  // Reglas inversor agresivo: pesos individuales
  const ruleViolations = [];
  for (const a of pf.assets) {
    if (a.type === 'Pilares' && a.weight > 0.25) ruleViolations.push(`${a.name} supera el 25% (pilar)`);
    if (a.type === 'Micro/Small/Mid Caps' && a.weight > 0.15) ruleViolations.push(`${a.name} supera el 15% (small/mid cap)`);
  }

  return { checks: out, beta, losers, market: marketInfo, companies: n, ruleViolations };
}

/** Distribución por tipo de activo. */
export function weightsByType(pf) {
  const m = new Map();
  for (const a of pf.assets) m.set(a.type || 'Otros', (m.get(a.type || 'Otros') || 0) + a.value);
  return ASSET_TYPES.filter((t) => m.has(t)).map((t) => ({
    type: t,
    value: m.get(t),
    weight: pf.totalValue > 0 ? m.get(t) / pf.totalValue : 0,
  }));
}

/**
 * Registrar una compra/venta sobre una posición: recalcula nº de acciones y
 * precio medio ponderado (las ventas no alteran el precio medio).
 */
export function applyTrade(position, { side, qty, price }) {
  const q0 = Number(position.qty) || 0;
  const p0 = Number(position.avgPrice) || 0;
  const q = Number(qty) || 0;
  const p = Number(price) || 0;
  if (side === 'sell') {
    const nq = Math.max(0, q0 - q);
    return { ...position, qty: round(nq, 8), realized: (Number(position.realized) || 0) + q * (p - p0) };
  }
  const nq = q0 + q;
  const avg = nq > 0 ? (q0 * p0 + q * p) / nq : 0;
  return { ...position, qty: round(nq, 8), avgPrice: round(avg, 6) };
}

function round(x, d) {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}

/** Pares FX necesarios para convertir todo a la divisa principal. */
export function neededCurrencies(positions, brokers, quotes, currency) {
  const set = new Set();
  for (const p of positions) {
    const b = brokers.find((x) => x.id === p.brokerId);
    const c = isMarketPosition(p)
      ? quotes?.[p.symbol]?.currency || p.quoteCurrency || b?.currency
      : b?.currency;
    if (c && c !== currency) set.add(c);
  }
  return [...set];
}
