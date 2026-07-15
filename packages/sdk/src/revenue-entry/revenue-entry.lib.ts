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
 * A recognized revenue entry only counts toward the funding pool once the
 * client has actually paid it — `paid_at` is null (due by client) by default
 * for every entry, until a manager marks it paid.
 */
export function revenueEntryPaid(entry: Pick<RevenueEntry, 'paid_at'>): boolean {
  return entry.paid_at != null;
}

/** Recognized revenue still due by the client (not yet marked paid), in cents. */
export function dueRevenue(
  revenueEntries: Array<Pick<RevenueEntry, 'amount_cents' | 'paid_at'>>,
): number {
  return revenueEntries
    .filter((r) => !revenueEntryPaid(r))
    .reduce((acc, r) => acc + (r.amount_cents ?? 0), 0);
}

/**
 * Funding still available in a project's pool:
 *   cumulative PAID revenue (due-by-client revenue does not count yet)
 *   - cumulative referral payouts
 *   - cumulative fixed costs (hosting, tooling, etc.)
 *   - cumulative invoice payments
 * Floored at zero (matches settle_project_month).
 */
export function availableFunding(
  revenueEntries: Array<Pick<RevenueEntry, 'amount_cents' | 'paid_at'>>,
  referralEarnings: Array<{ amount_cents: number }>,
  paidInvoices: Array<{ amount_paid_cents: number }>,
  fixedCostCents = 0,
): number {
  const revenue = revenueEntries
    .filter(revenueEntryPaid)
    .reduce((acc, r) => acc + (r.amount_cents ?? 0), 0);
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
