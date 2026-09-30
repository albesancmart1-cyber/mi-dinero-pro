export const uid = () =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export const DEFAULT_CATEGORIES = [
  { id: 'c-super', name: 'Supermercado', type: 'expense', icon: '🛒' },
  { id: 'c-rest', name: 'Restaurantes', type: 'expense', icon: '🍽️' },
  { id: 'c-casa', name: 'Vivienda', type: 'expense', icon: '🏠' },
  { id: 'c-sumin', name: 'Suministros', type: 'expense', icon: '💡' },
  { id: 'c-trans', name: 'Transporte', type: 'expense', icon: '🚗' },
  { id: 'c-ocio', name: 'Ocio', type: 'expense', icon: '🎉' },
  { id: 'c-ropa', name: 'Ropa', type: 'expense', icon: '👕' },
  { id: 'c-salud', name: 'Salud', type: 'expense', icon: '💊' },
  { id: 'c-subs', name: 'Suscripciones', type: 'expense', icon: '🔁' },
  { id: 'c-viajes', name: 'Viajes', type: 'expense', icon: '✈️' },
  { id: 'c-regalos', name: 'Regalos', type: 'expense', icon: '🎁' },
  { id: 'c-formac', name: 'Formación', type: 'expense', icon: '📚' },
  { id: 'c-otros-g', name: 'Otros gastos', type: 'expense', icon: '📦' },
  { id: 'c-nomina', name: 'Nómina', type: 'income', icon: '💼' },
  { id: 'c-extra', name: 'Ingresos extra', type: 'income', icon: '✨' },
  { id: 'c-divid', name: 'Dividendos', type: 'income', icon: '📈' },
  { id: 'c-otros-i', name: 'Otros ingresos', type: 'income', icon: '💰' },
];

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
