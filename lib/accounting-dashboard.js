/**
 * Owner finance dashboard — today's money at a glance, all derived from the
 * ledger (plus the expenses table for category breakdown). Read-only.
 */

import { accountBalance } from './accounting.js';
import { profitAndLoss } from './accounting-reports.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (n) => Number(n || 0);

export async function financeDashboard(db) {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

  const pnl = await profitAndLoss(db, { from: today, to: today });
  const salesToday = pnl.income.find((i) => i.code === '4010')?.amount || 0;

  const [cash, bank, apRaw] = await Promise.all([
    accountBalance(db, '1010'),
    accountBalance(db, '1020'),
    accountBalance(db, '2010'), // credit-normal, so outstanding = -(debit-credit)
  ]);

  const topCats = await db.all(
    `SELECT category, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS n
     FROM expenses WHERE expense_date = ? AND COALESCE(category, '') <> ''
     GROUP BY category ORDER BY total DESC LIMIT 5`,
    [today]
  );

  const salesSeries = await db.all(
    `SELECT je.entry_date AS d, COALESCE(SUM(jl.credit - jl.debit), 0) AS sales
     FROM journal_lines jl
     JOIN journal_entries je ON jl.journal_id = je.id
     JOIN accounts a ON jl.account_id = a.id
     WHERE a.code = '4010' AND je.entry_date >= ?
     GROUP BY je.entry_date ORDER BY d`,
    [weekAgo]
  );

  return {
    today,
    sales_today: round2(salesToday),
    expenses_today: round2(pnl.totalExpense),
    profit_today: round2(pnl.netProfit),
    cash_in_drawer: round2(cash),
    bank_balance: round2(bank),
    outstanding_ap: round2(-apRaw),
    top_expense_categories: topCats.map((r) => ({ category: r.category, total: round2(r.total), count: num(r.n) })),
    sales_trend: salesSeries.map((r) => ({ date: String(r.d).slice(0, 10), sales: round2(r.sales) })),
  };
}
