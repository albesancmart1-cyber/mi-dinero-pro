import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetStatus, expectedInMonth, materializeRecurring, monthlyEquivalent, monthTotals, paysPerYear } from '../src/lib/finance.js';
import { compositionSlices, computePortfolio } from '../src/lib/portfolio.js';
import { DEFAULT_CATEGORIES, upgradeCategories } from '../src/lib/defaults.js';

let n = 0;
const id = () => `x${n++}`;

test('la inversión no cuenta como gasto', () => {
  const tx = [
    { date: '2026-09-01', type: 'income', amount: 2000, categoryId: 'c-nomina' },
    { date: '2026-09-02', type: 'expense', amount: 800, categoryId: 'c-casa' },
    { date: '2026-09-03', type: 'investment', amount: 300, categoryId: 'c-inv-fondos' },
  ];
  const t = monthTotals(tx, '2026-09');
  assert.equal(t.expense, 800);
  assert.equal(t.investment, 300);
  assert.equal(t.balance, 1200); // ahorro
  assert.equal(t.free, 900); // lo que queda en la cuenta
});

test('presupuesto en tres bloques y "sin asignar"', () => {
  const state = {
    categories: DEFAULT_CATEGORIES,
    budgets: { '2026-01': { 'c-nomina': 2100, 'c-casa': 800, 'c-super': 300, 'c-inv-fondos': 400 } },
    transactions: [
      { date: '2026-09-01', type: 'income', amount: 2100, categoryId: 'c-nomina' },
      { date: '2026-09-02', type: 'expense', amount: 120, categoryId: 'c-super' },
      { date: '2026-09-05', type: 'investment', amount: 250, categoryId: 'c-inv-fondos' },
    ],
  };
  const st = budgetStatus(state, '2026-09');
  assert.equal(st.sections.income.planned, 2100);
  assert.equal(st.sections.expense.planned, 1100);
  assert.equal(st.sections.investment.planned, 400);
  assert.equal(st.sections.investment.actual, 250);
  assert.equal(st.sections.investment.rows[0].remaining, 150);
  assert.equal(st.unassigned, 600);
  assert.equal(st.totalLimit, 1100); // compatibilidad
});

test('nómina de 14 pagas: paga extra en junio y diciembre', () => {
  const salary = { id: 's', kind: 'salary', name: 'Nómina Inditex', type: 'income', amount: 2000, frequency: 'monthly', nextDate: '2026-05-28',
    active: true, autoPost: true, categoryId: 'c-nomina', extraPays: [6, 12], domain: 'inditex.com' };
  assert.equal(paysPerYear(salary), 14);
  assert.equal(Math.round(monthlyEquivalent(salary) * 100) / 100, 2333.33);
  assert.equal(expectedInMonth(salary, '2026-06'), 4000);
  assert.equal(expectedInMonth(salary, '2026-07'), 2000);
  const { transactions } = materializeRecurring([salary], '2026-07-30', id);
  assert.deepEqual(transactions.map((t) => [t.date, t.amount, !!t.extraPay]), [
    ['2026-05-28', 2000, false], ['2026-06-28', 2000, false], ['2026-06-28', 2000, true], ['2026-07-28', 2000, false],
  ]);
  assert.ok(transactions.every((t) => t.domain === 'inditex.com'));
  // Paga extra con importe distinto
  const s2 = { ...salary, extraAmount: 1500 };
  assert.equal(expectedInMonth(s2, '2026-12'), 3500);
});

test('migración v3 añade categorías de inversión al final', () => {
  const cats = upgradeCategories([{ id: 'c-super', name: 'Súper', type: 'expense', icon: 'cart' }, { id: 'c-nomina', name: 'Nómina', type: 'income', icon: 'briefcase' }]);
  const inv = cats.filter((c) => c.type === 'investment');
  assert.equal(inv.length, 5);
  assert.equal(cats[cats.length - 1].type, 'investment');
});

test('composición actual y deseada comparten colores y agrupan en "Otros"', () => {
  const mk = (name, value, targetWeight) => ({ id: name, brokerId: 'b', name, symbol: '', type: 'Otros', avgPrice: value, manualValue: value, targetWeight });
  const positions = [mk('A', 500, 0.4), mk('B', 300, 0.1), mk('C', 200, 0), mk('D', 0, 0.5)];
  const pf = computePortfolio(positions, { quotes: {}, fx: {}, currency: 'EUR', brokers: [{ id: 'b', currency: 'EUR' }] });
  const c = compositionSlices(pf);
  const slot = (arr, l) => arr.find((e) => e.label === l)?.slot;
  assert.deepEqual(c.current.map((e) => e.label), ['A', 'D', 'B', 'C'].filter((l) => l !== 'D'));
  assert.deepEqual(c.target.map((e) => e.label).sort(), ['A', 'B', 'D']);
  assert.equal(slot(c.current, 'A'), slot(c.target, 'A'));
  assert.equal(c.deviations[0].label, 'D'); // 0% actual vs 50% deseado
  // Más de 8 activos → "Otros"
  const many = Array.from({ length: 11 }, (_, i) => mk(`P${i}`, 100 + i, 1 / 11));
  const pf2 = computePortfolio(many, { quotes: {}, fx: {}, currency: 'EUR', brokers: [{ id: 'b', currency: 'EUR' }] });
  const c2 = compositionSlices(pf2);
  assert.equal(c2.current.length, 9);
  assert.equal(c2.current[8].label, 'Otros (3)');
  assert.equal(c2.current[8].slot, null);
});
