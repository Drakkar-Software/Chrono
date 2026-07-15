import type { RevenueSource } from '../revenue-source/revenue-source.entity';
import { monthlyRecurringAmount } from '../revenue-source/revenue-source.lib';
import type { RevenueEntry } from './revenue-entry.entity';

// `minutesToDays` lives in ../time-entry/time-entry.lib (single source of the
// hours->days->cents math); import it from there when you need it here.

/** Recognized amount (cents) for a recurring source in one month. */
export function recurringRevenue(
  source: Pick<RevenueSource, 'type' | 'content'>,
): number {
  return monthlyRecurringAmount(source);
}

/** time_based: round(billableDays * clientTjmCents). Matches the DB RPC. */
export function timeBasedRevenue(
  billableDays: number,
  clientTjmCents: number,
): number {
  return Math.round(billableDays * clientTjmCents);
}

/** self_billing: time-based amount uplifted by `markupPct` percent. */
export function selfBillingRevenue(
  billableDays: number,
  clientTjmCents: number,
  markupPct = 0,
): number {
  const base = timeBasedRevenue(billableDays, clientTjmCents);
  return Math.round(base * (1 + markupPct / 100));
}

/**
 * Funding still available in a project's pool:
 *   cumulative recognized revenue
 *   - cumulative referral payouts
 *   - cumulative fixed costs (hosting, tooling, etc.)
 *   - cumulative invoice payments
 * Floored at zero (matches settle_project_month).
 */
export function availableFunding(
  revenueEntries: Array<Pick<RevenueEntry, 'amount_cents'>>,
  referralEarnings: Array<{ amount_cents: number }>,
  paidInvoices: Array<{ amount_paid_cents: number }>,
  fixedCostCents = 0,
): number {
  const revenue = revenueEntries.reduce(
    (acc, r) => acc + (r.amount_cents ?? 0),
    0,
  );
  const referral = referralEarnings.reduce(
    (acc, r) => acc + (r.amount_cents ?? 0),
    0,
  );
  const paid = paidInvoices.reduce(
    (acc, i) => acc + (i.amount_paid_cents ?? 0),
    0,
  );
  return Math.max(0, revenue - referral - fixedCostCents - paid);
}

/**
 * Project margin = revenue - referral payouts - fixed costs - freelancer costs
 * - reimbursable expenses (cents). Expenses are a real cost but, unlike fixed
 * costs, are paid outside the FIFO pool (see availableFunding) — they only
 * affect margin, not funding.
 */
export function projectMargin(
  revenueCents: number,
  referralCents: number,
  costCents: number,
  fixedCostCents = 0,
  expenseCents = 0,
): number {
  return revenueCents - referralCents - fixedCostCents - costCents - expenseCents;
}
