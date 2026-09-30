import { useMemo } from 'react';
import { useStore } from '../lib/store.jsx';
import { useMarket } from '../lib/market.jsx';
import { budgetStatus, monthOf, monthlySeries, monthTotals, subscriptionAlerts, todayISO, upcoming } from '../lib/finance.js';
import { dateLabel, money, monthLabel, pct, signedMoney, tone } from '../lib/format.js';
import { GroupedBars } from '../components/charts.jsx';
import { Empty, Progress, Stat } from '../components/ui.jsx';
import { TxItem } from './Movimientos.jsx';

export default function Dashboard({ go, onQuickAdd }) {
  const { state } = useStore();
  const { portfolio: pf } = useMarket();
  const cur = state.settings.currency;
  const today = todayISO();
  const month = monthOf(today);
  const t = monthTotals(state.transactions, month);
  const bs = budgetStatus(state, month);
  const catById = useMemo(() => Object.fromEntries(state.categories.map((c) => [c.id, c])), [state.categories]);
  const next = upcoming(state.recurring, today, 14);
  const alerts = subscriptionAlerts(state.recurring, today, 7);
  const series = monthlySeries(state.transactions, month, 6);
  const cash = state.accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const netWorth = cash + pf.totalValue;
  const recent = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 6);
  const overBudget = bs.rows.filter((r) => r.limit > 0 && r.spent > r.limit);
  const topCats = bs.rows.filter((r) => r.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 5);

  return (
    <>
      <div className="page-head">
        <div><h1>Hola 👋</h1><div className="sub">{monthLabel(month)} · así van tus finanzas</div></div>
        <button className="btn primary" onClick={onQuickAdd}>+ Añadir gasto o ingreso</button>
      </div>

      {(alerts.length > 0 || overBudget.length > 0) && (
        <div className="stack" style={{ marginBottom: 16 }}>
          {alerts.map((r) => (
            <div key={r.id} className={`alert${r.overdue ? ' crit' : ''}`} style={{ cursor: 'pointer' }} onClick={() => go('fijos')}>
              ⏰ <span><b>{r.name}</b>: {r.overdue ? 'se pasó la fecha para cancelarla' : `cancélala antes del ${dateLabel(r.cancelBy)}`} si no la quieres seguir pagando.</span>
            </div>
          ))}
          {overBudget.map((r) => (
            <div key={r.category.id} className="alert" style={{ cursor: 'pointer' }} onClick={() => go('presupuestos')}>
              ⚠️ <span>Te has pasado del presupuesto de <b>{r.category.name}</b> en {money(r.spent - r.limit, cur)}.</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label="Ingresos del mes" value={money(t.income, cur)} />
        <Stat label="Gastos del mes" value={money(t.expense, cur)}
          delta={bs.totalLimit > 0 ? `${pct(t.expense / bs.totalLimit, 0)} del presupuesto` : null} />
        <Stat label="Ahorro del mes" value={money(t.balance, cur)} deltaClass={tone(t.balance)}
          delta={t.income > 0 ? `Tasa de ahorro ${pct(t.balance / t.income, 0)}` : null} />
        <div className="card stat" style={{ cursor: 'pointer' }} onClick={() => go('inversiones')}>
          <div className="label">Cartera de inversión</div>
          <div className="value tnum">{money(pf.totalValue, cur)}</div>
          <div className={`delta ${tone(pf.pnl)}`}>{pct(pf.returnPct, 2, true)} · {signedMoney(pf.pnl, cur)}</div>
        </div>
      </div>

      <div className="grid g3">
        <div className="card span2">
          <div className="card-head"><h2>Ingresos y gastos</h2><span className="small muted">últimos 6 meses</span></div>
          <GroupedBars data={series.map((s) => ({ x: s.month, income: s.income, expense: s.expense }))}
            series={[{ key: 'income', label: 'Ingresos', color: 'var(--s3)' }, { key: 'expense', label: 'Gastos', color: 'var(--s2)' }]}
            format={(v) => money(v, cur, 0)} xLabel={(x, long) => monthLabel(x, !long)} />
        </div>

        <div className="card">
          <div className="card-head"><h2>Patrimonio</h2></div>
          <div className="stat"><div className="value tnum">{money(netWorth, cur)}</div></div>
          <div className="list" style={{ marginTop: 8 }}>
            {state.accounts.map((a) => (
              <div className="list-item" key={a.id}><div className="main">{a.name}</div><div className="amt">{money(a.balance, cur)}</div></div>
            ))}
            <div className="list-item"><div className="main">Inversiones</div><div className="amt">{money(pf.totalValue, cur)}</div></div>
          </div>
          {state.accounts.length === 0 && <p className="small muted">Añade tus cuentas bancarias en Ajustes para ver tu patrimonio completo.</p>}
        </div>

        <div className="card">
          <div className="card-head"><h2>Presupuesto</h2><button className="btn sm ghost" onClick={() => go('presupuestos')}>Ver →</button></div>
          {topCats.length === 0 ? <Empty>Sin gastos este mes</Empty> : (
            <div className="stack">
              {topCats.map((r) => (
                <div key={r.category.id}>
                  <div className="row small" style={{ marginBottom: 4 }}>
                    <span>{r.category.icon} {r.category.name}</span><span className="spacer" />
                    <span className="tnum"><b>{money(r.spent, cur, 0)}</b>{r.limit > 0 && <span className="muted"> / {money(r.limit, cur, 0)}</span>}</span>
                  </div>
                  <Progress ratio={r.limit > 0 ? r.ratio : 0} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h2>Próximos 14 días</h2><button className="btn sm ghost" onClick={() => go('fijos')}>Ver →</button></div>
          {next.length === 0 ? <Empty>Nada programado</Empty> : (
            <div className="list">
              {next.slice(0, 6).map((r) => (
                <div className="list-item" key={`${r.id}-${r.date}`}>
                  <div className="ico">{catById[r.categoryId]?.icon || '🔁'}</div>
                  <div className="main"><div className="title">{r.name}</div><div className="meta">{dateLabel(r.date)}</div></div>
                  <div className={`amt ${r.type === 'income' ? 'pos' : ''}`}>{r.type === 'income' ? '+' : '−'}{money(r.amount, cur)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h2>Últimos movimientos</h2><button className="btn sm ghost" onClick={() => go('movimientos')}>Ver →</button></div>
          {recent.length === 0 ? <Empty>Pulsa <b>+</b> para registrar tu primer gasto.</Empty> : (
            <div className="list">{recent.map((tx) => <TxItem key={tx.id} t={tx} cat={catById[tx.categoryId]} cur={cur} />)}</div>
          )}
        </div>
      </div>
    </>
  );
}
