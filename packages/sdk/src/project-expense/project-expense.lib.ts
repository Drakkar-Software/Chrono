import type { ProjectExpense } from './project-expense.entity';

type Expense = Pick<ProjectExpense, 'user_id' | 'amount_cents' | 'status' | 'reimbursed_at'>;

/** Total of approved expenses (cents) — the real project cost, regardless of reimbursement state. */
export function sumApprovedExpenses(expenses: Pick<Expense, 'amount_cents' | 'status'>[]): number {
  return expenses
    .filter((e) => e.status === 'approved')
    .reduce((acc, e) => acc + (e.amount_cents ?? 0), 0);
}

/** Approved expenses not yet marked reimbursed. */
export function reimbursementsOwed(expenses: Expense[]): Expense[] {
  return expenses.filter((e) => e.status === 'approved' && e.reimbursed_at == null);
}

/** Cents owed per freelancer (approved, not yet reimbursed). */
export function expensesOwedByUser(expenses: Expense[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of reimbursementsOwed(expenses)) {
    out[e.user_id] = (out[e.user_id] ?? 0) + (e.amount_cents ?? 0);
  }
  return out;
}
