import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  budgetVerdict, copyBudgetMonth, effectiveBudget, effectiveValue, migrateBudgets,
  monthsOfYear, removeBudgetCat, setBudgetCell, setBudgetCells,
} from '../src/lib/budget.js';
import { budgetStatus } from '../src/lib/finance.js';
import { DEFAULT_CATEGORIES } from '../src/lib/defaults.js';

const val = (b, c, m) => effectiveValue(b, c, m);
const year = (b, c, y = 2026) => monthsOfYear(y).map((m) => val(b, c, m));

test('rellenar enero rellena todos los meses siguientes (también el año siguiente)', () => {
  const b = setBudgetCell({}, 'c-super', '2026-01', 300);
  assert.deepEqual(year(b, 'c-super'), Array(12).fill(300));
  assert.equal(val(b, 'c-super', '2027-03'), 300);
  assert.equal(val(b, 'c-super', '2025-12'), 0); // los anteriores no cambian
});

test('un cambio se propaga hasta el siguiente mes personalizado', () => {
  let b = setBudgetCell({}, 'c-super', '2026-01', 300);
  b = setBudgetCell(b, 'c-super', '2026-06', 500); // personalizo junio
  assert.deepEqual(year(b, 'c-super'), [300, 300, 300, 300, 300, 500, 500, 500, 500, 500, 500, 500]);
  b = setBudgetCell(b, 'c-super', '2026-02', 350); // febrero llega hasta mayo
  assert.deepEqual(year(b, 'c-super'), [300, 350, 350, 350, 350, 500, 500, 500, 500, 500, 500, 500]);
  b = setBudgetCell(b, 'c-super', '2026-01', 320); // enero no pisa febrero (personalizado)
  assert.deepEqual(year(b, 'c-super').slice(0, 3), [320, 350, 350]);
  // Cambiar el último mes personalizado arrastra los siguientes
  b = setBudgetCell(b, 'c-super', '2026-06', 450);
  assert.deepEqual(year(b, 'c-super').slice(4, 8), [350, 450, 450, 450]);
});

test('vaciar un mes también se propaga y 0 explícito bloquea la herencia', () => {
  let b = setBudgetCell({}, 'c-ocio', '2026-01', 100);
  b = setBudgetCell(b, 'c-ocio', '2026-04', 0);
  assert.deepEqual(year(b, 'c-ocio'), [100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(effectiveBudget({ budgets: b, budgetCats: ['c-ocio'] }, '2026-05')['c-ocio'], undefined);
});

test('escribir el mismo valor heredado no crea entradas', () => {
  const b = setBudgetCell({}, 'c-super', '2026-01', 300);
  assert.equal(setBudgetCell(b, 'c-super', '2026-03', 300), b);
});

test('pegar varias celdas seguidas (fila copiada de Excel)', () => {
  const edits = [100, 110, 120].map((value, i) => ({ cat: 'c-rest', month: `2026-0${i + 1}`, value }));
  const b = setBudgetCells({}, edits);
  assert.deepEqual(year(b, 'c-rest').slice(0, 5), [100, 110, 120, 120, 120]);
});

test('copiar el presupuesto de un mes a otros', () => {
  let b = setBudgetCells({}, [
    { cat: 'c-super', month: '2026-01', value: 300 }, { cat: 'c-rest', month: '2026-01', value: 100 },
  ]);
  b = setBudgetCell(b, 'c-super', '2026-05', 400); // mayo es distinto
  const cats = ['c-super', 'c-rest'];
  // Solo a marzo, sin tocar los meses siguientes
  const only = copyBudgetMonth(b, cats, '2026-05', ['2026-03'], { propagate: false });
  assert.deepEqual(year(only, 'c-super').slice(0, 6), [300, 300, 400, 300, 400, 400]);
  // Con propagación: marzo y los siguientes hasta el próximo mes distinto
  const prop = copyBudgetMonth(b, cats, '2026-05', ['2026-03'], { propagate: true });
  assert.deepEqual(year(prop, 'c-super').slice(0, 6), [300, 300, 400, 400, 400, 400]);
  // Copiar a varios meses
  const many = copyBudgetMonth(b, cats, '2026-01', ['2026-09', '2026-10'], { propagate: false });
  // Septiembre y octubre = enero (300); agosto y los meses siguientes se quedan como estaban (400)
  assert.deepEqual(year(many, 'c-super').slice(7, 12), [400, 300, 300, 400, 400]);
});

test('quitar una categoría la borra de todos los meses', () => {
  let b = setBudgetCell({}, 'c-super', '2026-01', 300);
  b = setBudgetCell(b, 'c-rest', '2026-02', 80);
  b = removeBudgetCat(b, 'c-super');
  assert.equal(val(b, 'c-super', '2026-09'), 0);
  assert.equal(val(b, 'c-rest', '2026-09'), 80);
});

test('el estado del presupuesto usa los valores heredados', () => {
  const state = {
    categories: DEFAULT_CATEGORIES,
    budgetCats: ['c-nomina', 'c-super', 'c-inv-fondos'],
    budgets: setBudgetCells({}, [
      { cat: 'c-nomina', month: '2026-01', value: 2100 }, { cat: 'c-super', month: '2026-01', value: 300 }, { cat: 'c-inv-fondos', month: '2026-01', value: 200 },
    ]),
    transactions: [{ date: '2026-09-02', type: 'expense', amount: 120, categoryId: 'c-super' }],
  };
  const st = budgetStatus(state, '2026-09');
  assert.equal(st.sections.expense.planned, 300);
  assert.equal(st.sections.income.planned, 2100);
  assert.equal(st.unassigned, 1600);
});

test('veredicto: por debajo / por encima del presupuesto', () => {
  assert.equal(budgetVerdict('expense', 300, 120).state, 'ok');
  assert.equal(budgetVerdict('expense', 300, 120).relation, 'below');
  assert.equal(budgetVerdict('expense', 300, 270).state, 'near');
  const over = budgetVerdict('expense', 300, 336);
  assert.deepEqual([over.state, over.tone, over.diff, over.relation], ['over', 'bad', 36, 'above']);
  assert.equal(budgetVerdict('expense', 0, 20).state, 'unbudgeted');
  assert.equal(budgetVerdict('expense', 0, 0).state, 'none');
  // Ingresos e inversión: alcanzar el objetivo es bueno
  assert.equal(budgetVerdict('income', 2100, 2100).label, 'Cumplido');
  assert.equal(budgetVerdict('income', 2100, 800).state, 'pending');
  assert.equal(budgetVerdict('income', 2100, 800, true).state, 'short');
  assert.equal(budgetVerdict('investment', 400, 450).label, 'Superado');
  assert.equal(budgetVerdict('income', 0, 50).state, 'extra');
});

test('migración: plantilla y meses antiguos → presupuesto heredado con categorías', () => {
  const old = {
    categories: DEFAULT_CATEGORIES,
    budgetTemplate: { 'c-super': 300, 'c-rest': 150 },
    budgets: { '2026-08': { 'c-super': 100, 'c-casa': 800 } },
    transactions: [{ date: '2026-03-04', type: 'expense', amount: 5, categoryId: 'c-super' }],
  };
  const s = migrateBudgets(old);
  assert.equal(s.budgetVersion, 2);
  assert.deepEqual(s.budgetTemplate, {});
  assert.deepEqual(s.budgetCats, ['c-super', 'c-rest', 'c-casa']);
  assert.equal(val(s.budgets, 'c-super', '2026-04'), 300); // plantilla desde el primer mes con datos
  assert.equal(val(s.budgets, 'c-super', '2026-09'), 100); // agosto personalizado se hereda después
  assert.equal(val(s.budgets, 'c-rest', '2026-09'), 150);
  // Idempotente
  assert.deepEqual(migrateBudgets(s), s);
});
