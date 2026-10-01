export const uid = () =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export const DEFAULT_CATEGORIES = [
  { id: 'c-super', name: 'Supermercado', type: 'expense', icon: 'cart' },
  { id: 'c-rest', name: 'Restaurantes', type: 'expense', icon: 'fork' },
  { id: 'c-casa', name: 'Vivienda', type: 'expense', icon: 'house' },
  { id: 'c-sumin', name: 'Suministros', type: 'expense', icon: 'bolt' },
  { id: 'c-telef', name: 'Telefonía e internet', type: 'expense', icon: 'wifi' },
  { id: 'c-trans', name: 'Transporte', type: 'expense', icon: 'car' },
  { id: 'c-combust', name: 'Combustible', type: 'expense', icon: 'fuel' },
  { id: 'c-ropa', name: 'Ropa y calzado', type: 'expense', icon: 'tshirt' },
  { id: 'c-hogar', name: 'Hogar', type: 'expense', icon: 'sofa' },
  { id: 'c-tecno', name: 'Tecnología y compras online', type: 'expense', icon: 'laptop' },
  { id: 'c-ocio', name: 'Ocio', type: 'expense', icon: 'ticket' },
  { id: 'c-subs', name: 'Suscripciones', type: 'expense', icon: 'repeat' },
  { id: 'c-salud', name: 'Salud', type: 'expense', icon: 'health' },
  { id: 'c-belleza', name: 'Belleza y cuidado', type: 'expense', icon: 'drop' },
  { id: 'c-deporte', name: 'Deporte', type: 'expense', icon: 'dumbbell' },
  { id: 'c-viajes', name: 'Viajes', type: 'expense', icon: 'airplane' },
  { id: 'c-seguros', name: 'Seguros', type: 'expense', icon: 'shield' },
  { id: 'c-regalos', name: 'Regalos', type: 'expense', icon: 'gift' },
  { id: 'c-formac', name: 'Formación', type: 'expense', icon: 'book' },
  { id: 'c-mascotas', name: 'Mascotas', type: 'expense', icon: 'paw' },
  { id: 'c-bancos', name: 'Bancos y comisiones', type: 'expense', icon: 'bank' },
  { id: 'c-impuestos', name: 'Impuestos', type: 'expense', icon: 'doc' },
  { id: 'c-otros-g', name: 'Otros gastos', type: 'expense', icon: 'box' },
  { id: 'c-nomina', name: 'Nómina', type: 'income', icon: 'briefcase' },
  { id: 'c-extra', name: 'Ingresos extra', type: 'income', icon: 'sparkles' },
  { id: 'c-divid', name: 'Dividendos', type: 'income', icon: 'chart' },
  { id: 'c-otros-i', name: 'Otros ingresos', type: 'income', icon: 'banknote' },
  { id: 'c-inv-fondos', name: 'Fondos indexados', type: 'investment', icon: 'pie' },
  { id: 'c-inv-acciones', name: 'Acciones', type: 'investment', icon: 'trend' },
  { id: 'c-inv-cripto', name: 'Criptomonedas', type: 'investment', icon: 'coins' },
  { id: 'c-inv-pension', name: 'Plan de pensiones', type: 'investment', icon: 'piggy' },
  { id: 'c-inv-ahorro', name: 'Depósitos y cuentas remuneradas', type: 'investment', icon: 'bank' },
];

export const CATEGORIES_VERSION = 3;

/**
 * Pone al día las categorías guardadas: añade las nuevas categorías
 * predeterminadas y cambia los antiguos emojis por los iconos de línea.
 */
export function upgradeCategories(cats) {
  if (!cats?.length) return DEFAULT_CATEGORIES;
  const byId = Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, c]));
  const out = cats.map((c) => {
    const d = byId[c.id];
    if (d && !/^[a-z]+$/.test(c.icon || '')) return { ...c, icon: d.icon };
    return c;
  });
  const have = new Set(out.map((c) => c.id));
  // Las nuevas se insertan tras las de su mismo tipo
  for (const d of DEFAULT_CATEGORIES) {
    if (have.has(d.id)) continue;
    const lastSame = out.map((c) => c.type).lastIndexOf(d.type);
    const otrosId = { expense: 'c-otros-g', income: 'c-otros-i' }[d.type];
    const otros = otrosId ? out.findIndex((c) => c.id === otrosId) : -1;
    const at = otros >= 0 ? otros : lastSame >= 0 ? lastSame + 1 : out.length;
    out.splice(at, 0, d);
    have.add(d.id);
  }
  return out;
}

export function defaultState() {
  return {
    version: 1,
    updatedAt: 0,
    settings: {
      currency: 'EUR',
      targetAmount: 8000,
      rules: {},
    },
    categories: DEFAULT_CATEGORIES,
    categoriesVersion: CATEGORIES_VERSION,
    transactions: [],
    budgets: {},
    budgetTemplate: {},
    recurring: [],
    accounts: [],
    brokers: [{ id: 'b1', name: 'Broker1', currency: 'EUR' }],
    positions: [],
    history: [],
  };
}

/**
 * Cartera del Excel CARTERA.xlsx con tickers de Yahoo Finance ya asignados
 * (Broker1 y Broker2, % deseado de la hoja Cartera y precios objetivo a 5 años
 * de la hoja Seguimiento).
 */
export function excelSeed() {
  const b1 = 'b1', b2 = 'b2';
  const P = (brokerId, name, symbol, type, qty, avgPrice, targetWeight, target5y, extra = {}) => ({
    id: uid(), brokerId, name, symbol, type, qty, avgPrice, targetWeight, target5y, ...extra,
  });
  return {
    brokers: [
      { id: b1, name: 'Broker1', currency: 'EUR' },
      { id: b2, name: 'Broker2', currency: 'EUR' },
    ],
    positions: [
      P(b1, 'Microsoft', 'MSFT', 'Pilares', 2.7753, 449.67, 0.1375, 924, { quoteCurrency: 'USD', beta: 1.1012 }),
      P(b1, 'Meta Platforms', 'META', 'Pilares', 1.5, 626.31, 0.1375, 1155, { quoteCurrency: 'USD', beta: 1.2175 }),
      P(b1, 'Constellation Software', 'CSU.TO', 'Pilares', 0.3864, 3112.25, 0.1, 5400, { quoteCurrency: 'CAD', beta: 0.7202 }),
      P(b1, 'Amazon', 'AMZN', 'Pilares', 3, 233.05, 0.1375, 528, { quoteCurrency: 'USD', beta: 1.4522 }),
      P(b1, 'NVIDIA', 'NVDA', 'Large Caps', 2, 193.87, 0.05, 410, { quoteCurrency: 'USD', beta: 2.2184 }),
      P(b1, 'Alphabet', 'GOOGL', 'Pilares', 1.3328, 335.69, 0.1375, 578, { quoteCurrency: 'USD', beta: 1.2129 }),
      P(b1, 'Taiwan Semiconductor', '2330.TW', 'Pilares', 0, 0, 0.05, 3811, { quoteCurrency: 'TWD', beta: 1.2197 }),
      P(b1, 'Visa', 'V', 'Pilares', 0, 0, 0.05, 2458, { quoteCurrency: 'USD', beta: 0.7642 }),
      P(b1, 'Efectivo', '', 'Efectivo', null, 1100, 0.1, null, { manualValue: 1100 }),
      P(b2, 'Bitcoin', 'BTC-EUR', 'Otros', 0.016213, 81000, 0.1, null, { quoteCurrency: 'EUR' }),
    ],
    settings: { targetAmount: 8000 },
  };
}
