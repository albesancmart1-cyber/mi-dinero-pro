// Lógica de finanzas personales: movimientos, presupuestos y recurrentes.
// Funciones puras (fechas en formato 'YYYY-MM-DD', meses 'YYYY-MM').

export const FREQUENCIES = {
  weekly: { label: 'Semanal', perMonth: 52 / 12 },
  monthly: { label: 'Mensual', perMonth: 1 },
  bimonthly: { label: 'Bimestral', perMonth: 1 / 2 },
  quarterly: { label: 'Trimestral', perMonth: 1 / 3 },
  semiannual: { label: 'Semestral', perMonth: 1 / 6 },
  yearly: { label: 'Anual', perMonth: 1 / 12 },
};

export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthOf(date) {
  return date.slice(0, 7);
}

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(y, m0) {
  return new Date(y, m0 + 1, 0).getDate();
}

/** Suma meses conservando el día de cobro original (31 → último día del mes). */
function addMonths(date, n, anchorDay) {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const day = Math.min(anchorDay || d, daysInMonth(target.getFullYear(), target.getMonth()));
  target.setDate(day);
  return todayISO(target);
}

export function nextOccurrence(date, frequency, anchorDay) {
  switch (frequency) {
    case 'weekly': {
      const [y, m, d] = date.split('-').map(Number);
      return todayISO(new Date(y, m - 1, d + 7));
    }
    case 'bimonthly': return addMonths(date, 2, anchorDay);
    case 'quarterly': return addMonths(date, 3, anchorDay);
    case 'semiannual': return addMonths(date, 6, anchorDay);
    case 'yearly': return addMonths(date, 12, anchorDay);
    case 'monthly':
    default: return addMonths(date, 1, anchorDay);
  }
}

/** Importe mensual equivalente de un recurrente. */
export function monthlyEquivalent(r) {
  return (Number(r.amount) || 0) * (FREQUENCIES[r.frequency]?.perMonth ?? 1);
}

/**
 * Genera los movimientos de los recurrentes vencidos hasta `today` (inclusive).
 * Devuelve { transactions: nuevos, recurring: recurrentes actualizados }.
 */
export function materializeRecurring(recurring, today, makeId) {
  const created = [];
  const updated = recurring.map((r) => {
    if (!r.active || !r.autoPost || !r.nextDate) return r;
    let next = r.nextDate;
    const anchor = r.anchorDay || Number(r.nextDate.slice(8, 10));
    let guard = 0;
    while (next <= today && (!r.endDate || next <= r.endDate) && guard < 500) {
      created.push({
        id: makeId(),
        date: next,
        type: r.type,
        amount: Number(r.amount) || 0,
        categoryId: r.categoryId,
        note: r.name,
        recurringId: r.id,
        ...(r.merchant ? { merchant: r.merchant } : {}),
      });
      next = nextOccurrence(next, r.frequency, anchor);
      guard++;
    }
    if (next === r.nextDate) return r;
    return { ...r, nextDate: next, anchorDay: anchor };
  });
  return { transactions: created, recurring: updated };
}

/** Próximos cargos/ingresos en los próximos `days` días. */
export function upcoming(recurring, today, days = 30) {
  const [y, m, d] = today.split('-').map(Number);
  const limit = todayISO(new Date(y, m - 1, d + days));
  const out = [];
  for (const r of recurring) {
    if (!r.active || !r.nextDate) continue;
    let next = r.nextDate;
    const anchor = r.anchorDay || Number(r.nextDate.slice(8, 10));
    let guard = 0;
    while (next <= limit && guard < 60) {
      if (next >= today && (!r.endDate || next <= r.endDate)) out.push({ ...r, date: next });
      next = nextOccurrence(next, r.frequency, anchor);
      guard++;
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Suscripciones con fecha de "cancelar antes de" próxima o vencida. */
export function subscriptionAlerts(recurring, today, days = 7) {
  const [y, m, d] = today.split('-').map(Number);
  const limit = todayISO(new Date(y, m - 1, d + days));
  return recurring
    .filter((r) => r.active && r.isSubscription && r.cancelBy && r.cancelBy <= limit)
    .map((r) => ({ ...r, overdue: r.cancelBy < today }))
    .sort((a, b) => a.cancelBy.localeCompare(b.cancelBy));
}

export function monthTotals(transactions, month) {
  let income = 0, expense = 0;
  const byCategory = {};
  for (const t of transactions) {
    if (monthOf(t.date) !== month) continue;
    const a = Number(t.amount) || 0;
    if (t.type === 'income') income += a;
    else {
      expense += a;
      byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + a;
    }
  }
  return { income, expense, balance: income - expense, byCategory };
}

/** Presupuesto de un mes: el del mes si existe, si no la plantilla por defecto. */
export function budgetFor(state, month) {
  return state.budgets?.[month] || state.budgetTemplate || {};
}

export function budgetStatus(state, month) {
  const budget = budgetFor(state, month);
  const { byCategory, expense, income } = monthTotals(state.transactions, month);
  const cats = state.categories.filter((c) => c.type === 'expense');
  const rows = cats
    .map((c) => {
      const limit = Number(budget[c.id]) || 0;
      const spent = byCategory[c.id] || 0;
      return { category: c, limit, spent, remaining: limit - spent, ratio: limit > 0 ? spent / limit : null };
    })
    .filter((r) => r.limit > 0 || r.spent > 0);
  const totalLimit = rows.reduce((s, r) => s + r.limit, 0);
  return { rows, totalLimit, totalSpent: expense, income, remaining: totalLimit - expense };
}

/** Serie de ingresos/gastos de los últimos `n` meses. */
export function monthlySeries(transactions, endMonth, n = 6) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = shiftMonth(endMonth, -i);
    const t = monthTotals(transactions, m);
    out.push({ month: m, income: t.income, expense: t.expense, balance: t.balance });
  }
  return out;
}
