import type { ReferralEarning } from './referral-earning.entity';

/** Referral amount (cents) for a percent applied to a revenue base. */
export function referralAmount(pct: number, revenueBaseCents: number): number {
  return Math.round((revenueBaseCents * pct) / 100);
}

/** Total of a set of referral earnings (cents). */
export function sumReferralEarnings(
  earnings: Array<Pick<ReferralEarning, 'amount_cents'>>,
): number {
  return earnings.reduce((acc, e) => acc + (e.amount_cents ?? 0), 0);
}
