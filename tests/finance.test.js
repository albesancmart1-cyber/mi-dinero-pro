import { test } from 'node:test';
import assert from 'node:assert/strict';
import { materializeRecurring, nextOccurrence, upcoming, subscriptionAlerts, budgetStatus, monthlyEquivalent } from '../src/lib/finance.js';

let n = 0;
const id = () => `t${n++}`;

test('mensual conserva el día 31 aunque pase por febrero', () => {
  assert.equal(nextOccurrence('2026-01-31', 'monthly', 31), '2026-02-28');
  assert.equal(nextOccurrence('2026-02-28', 'monthly', 31), '2026-03-31');
  assert.equal(nextOccurrence('2026-12-15', 'monthly'), '2027-01-15');
  assert.equal(nextOccurrence('2026-12-29', 'weekly'), '2027-01-05');
  assert.equal(nextOccurrence('2024-02-29', 'yearly', 29), '2025-02-28');
});

test('genera los movimientos vencidos y avanza la fecha', () => {
  const rec = [
    { id: 'r1', name: 'Nómina', type: 'income', amount: 2000, frequency: 'monthly', nextDate: '2026-07-28', active: true, autoPost: true, categoryId: 'c-nomina' },
    { id: 'r2', name: 'Netflix', type: 'expense', amount: 13.99, frequency: 'monthly', nextDate: '2026-10-05', active: true, autoPost: true },
    { id: 'r3', name: 'Cancelada', type: 'expense', amount: 5, frequency: 'monthly', nextDate: '2026-01-01', active: false, autoPost: true },
  ];
  const { transactions, recurring } = materializeRecurring(rec, '2026-09-30', id);
  assert.deepEqual(transactions.map((t) => t.date), ['2026-07-28', '2026-08-28', '2026-09-28']);
  assert.equal(recurring[0].nextDate, '2026-10-28');
  assert.equal(recurring[1], rec[1]);
  assert.equal(recurring[2], rec[2]);
  // Idempotente
  assert.equal(materializeRecurring(recurring, '2026-09-30', id).transactions.length, 0);
});

test('próximos cargos y alertas de suscripciones', () => {
  const rec = [
    { id: 'a', name: 'Gym', type: 'expense', amount: 40, frequency: 'monthly', nextDate: '2026-10-02', active: true },
    { id: 'b', name: 'Prueba', type: 'expense', amount: 9, frequency: 'monthly', nextDate: '2026-11-01', active: true, isSubscription: true, cancelBy: '2026-10-03' },
    { id: 'c', name: 'Vieja', type: 'expense', amount: 9, frequency: 'yearly', nextDate: '2027-01-01', active: true, isSubscription: true, cancelBy: '2026-09-01' },
  ];
  assert.deepEqual(upcoming(rec, '2026-09-30', 14).map((r) => r.id), ['a']);
  const al = subscriptionAlerts(rec, '2026-09-30', 7);
  assert.deepEqual(al.map((r) => [r.id, r.overdue]), [['c', true], ['b', false]]);
  assert.equal(monthlyEquivalent(rec[2]), 0.75);
});

test('presupuesto: un mes sin valor propio hereda el del mes anterior', () => {
  const state = {
    categories: [{ id: 'x', type: 'expense', name: 'Súper' }, { id: 'y', type: 'expense', name: 'Ocio' }],
    budgetCats: ['x', 'y'],
    budgets: { '2026-08': { x: 100, y: 50 } },
    transactions: [
      { date: '2026-09-02', type: 'expense', amount: 120, categoryId: 'x' },
      { date: '2026-09-03', type: 'expense', amount: 30, categoryId: 'y' },
      { date: '2026-09-03', type: 'income', amount: 1000, categoryId: 'z' },
    ],
  };
  const s9 = budgetStatus(state, '2026-09');
  assert.equal(s9.totalLimit, 150);
  assert.equal(s9.totalSpent, 150);
  assert.equal(s9.rows.find((r) => r.category.id === 'y').limit, 50);
  assert.equal(budgetStatus(state, '2026-07').totalLimit, 0); // antes del primer presupuesto
});
