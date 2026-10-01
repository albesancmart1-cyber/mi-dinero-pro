// Presupuesto mensual estilo hoja de cálculo.
//
// Modelo: state.budgets = { 'YYYY-MM': { [categoryId]: importe } } guarda solo los
// valores escritos. Un mes sin valor propio para una categoría HEREDA el del mes
// anterior más cercano que lo tenga (así el presupuesto se arrastra a los meses
// siguientes, también a otros años). state.budgetCats es la lista de categorías
// visibles en el presupuesto.
//
// Al cambiar un mes, el cambio se propaga a los meses siguientes hasta llegar a
// uno que hayas personalizado (con otro valor): ese y los posteriores no se tocan.

const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
const idx = (m) => { const [y, mo] = m.split('-').map(Number); return y * 12 + mo - 1; };
const fromIdx = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

const LOOKBACK = 240; // meses hacia atrás en los que se busca un valor heredado

export function monthsOfYear(year) {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

/** Importe presupuestado de una categoría en un mes (propio o heredado). */
export function effectiveValue(budgets, cat, month, template) {
  const start = idx(month);
  for (let i = 0; i <= LOOKBACK; i++) {
    const b = budgets?.[fromIdx(start - i)];
    if (has(b, cat)) return Number(b[cat]) || 0;
  }
  return Number(template?.[cat]) || 0; // compatibilidad con la antigua plantilla
}

/** Presupuesto efectivo de un mes: { categoryId: importe } (solo importes > 0). */
export function effectiveBudget(state, month) {
  const ids = new Set([...(state.budgetCats || []), ...Object.keys(state.budgetTemplate || {})]);
  for (const b of Object.values(state.budgets || {})) for (const k of Object.keys(b)) ids.add(k);
  const out = {};
  for (const id of ids) {
    const v = effectiveValue(state.budgets, id, month, state.budgetTemplate);
    if (v > 0) out[id] = v;
  }
  return out;
}

/**
 * Cambia el presupuesto de una categoría en un mes y propaga el cambio a los
 * meses siguientes que seguían el mismo valor.
 */
export function setBudgetCell(budgets, cat, month, value, template) {
  const v = Math.max(0, round2(value));
  const old = effectiveValue(budgets, cat, month, template);
  if (!has(budgets[month], cat) && v === old) return budgets;
  const next = { ...budgets, [month]: { ...(budgets[month] || {}), [cat]: v } };
  if (v === old) return next;
  const here = idx(month);
  const later = Object.keys(next).filter((m) => idx(m) > here && has(next[m], cat)).sort();
  for (const m of later) {
    if (round2(next[m][cat]) === old) next[m] = { ...next[m], [cat]: v };
    else break;
  }
  return next;
}

/** Como setBudgetCell, pero sin tocar ningún otro mes. */
export function setBudgetCellOnly(budgets, cat, month, value, template) {
  const v = Math.max(0, round2(value));
  const old = effectiveValue(budgets, cat, month, template);
  if (!has(budgets[month], cat) && v === old) return budgets;
  const after = fromIdx(idx(month) + 1);
  const next = { ...budgets, [month]: { ...(budgets[month] || {}), [cat]: v } };
  // El mes siguiente heredaba de este: se fija con el valor anterior para que no cambie
  if (!has(next[after], cat) && old !== v) next[after] = { ...(next[after] || {}), [cat]: old };
  return next;
}

/** Aplica varias ediciones seguidas: [{ cat, month, value }]. */
export function setBudgetCells(budgets, edits, template) {
  return edits.reduce((b, e) => setBudgetCell(b, e.cat, e.month, e.value, template), budgets);
}

/**
 * Copia el presupuesto de un mes a otros. `propagate`: los meses siguientes a
 * cada destino también lo siguen (hasta el próximo mes personalizado).
 */
export function copyBudgetMonth(budgets, cats, from, targets, { propagate = true, template } = {}) {
  let out = budgets;
  const values = Object.fromEntries(cats.map((c) => [c, effectiveValue(budgets, c, from, template)]));
  for (const t of [...targets].sort()) {
    if (t === from) continue;
    for (const c of cats) {
      out = (propagate ? setBudgetCell : setBudgetCellOnly)(out, c, t, values[c], template);
    }
  }
  return out;
}

/** Quita una categoría del presupuesto en todos los meses. */
export function removeBudgetCat(budgets, cat) {
  const out = {};
  for (const [m, b] of Object.entries(budgets)) {
    if (!has(b, cat)) { out[m] = b; continue; }
    const { [cat]: _drop, ...rest } = b;
    if (Object.keys(rest).length) out[m] = rest;
  }
  return out;
}

/**
 * Estado de cumplimiento de una línea del presupuesto.
 *  - Gastos: por debajo = bien; cerca del límite = aviso; por encima = mal.
 *  - Ingresos e inversión: alcanzar el objetivo = bien; por debajo = pendiente
 *    (o "por debajo" si el mes ya terminó).
 */
export function budgetVerdict(type, limit, actual, closed = false) {
  const diff = round2(actual - limit);
  const relation = diff > 0 ? 'above' : diff < 0 ? 'below' : 'equal';
  if (type === 'expense') {
    if (limit > 0) {
      if (actual > limit) return { state: 'over', tone: 'bad', label: 'Por encima', diff, relation };
      if (actual >= limit * 0.85) return { state: 'near', tone: 'warn', label: 'Al límite', diff, relation };
      return { state: 'ok', tone: 'ok', label: 'Por debajo', diff, relation };
    }
    if (actual > 0) return { state: 'unbudgeted', tone: 'warn', label: 'Sin presupuesto', diff, relation };
    return { state: 'none', tone: '', label: '', diff, relation };
  }
  if (limit > 0) {
    if (actual >= limit) return { state: 'ok', tone: 'ok', label: actual > limit ? 'Superado' : 'Cumplido', diff, relation };
    return closed
      ? { state: 'short', tone: 'bad', label: 'Por debajo', diff, relation }
      : { state: 'pending', tone: 'warn', label: 'Pendiente', diff, relation };
  }
  if (actual > 0) return { state: 'extra', tone: 'ok', label: 'No previsto', diff, relation };
  return { state: 'none', tone: '', label: '', diff, relation };
}

/**
 * Pone al día los presupuestos antiguos (una plantilla + un presupuesto por mes
 * con todos los datos) al modelo heredado y con categorías elegidas.
 */
export function migrateBudgets(s) {
  if ((s.budgetVersion || 1) >= 2) return { ...s, budgetCats: s.budgetCats || [], budgetVersion: 2 };
  const budgets = { ...(s.budgets || {}) };
  const template = s.budgetTemplate || {};
  if (Object.keys(template).length) {
    const months = [
      ...Object.keys(budgets),
      ...(s.transactions || []).map((t) => t.date.slice(0, 7)),
      new Date().toISOString().slice(0, 7),
    ].sort();
    const anchor = months[0];
    const cur = budgets[anchor] || {};
    const merged = { ...cur };
    for (const [k, v] of Object.entries(template)) if (!has(merged, k)) merged[k] = v;
    budgets[anchor] = merged;
  }
  const used = new Set();
  for (const b of Object.values(budgets)) for (const [k, v] of Object.entries(b)) if (Number(v) > 0) used.add(k);
  const order = (s.categories || []).map((c) => c.id);
  const budgetCats = [...used].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return { ...s, budgets, budgetTemplate: {}, budgetCats, budgetVersion: 2 };
}
