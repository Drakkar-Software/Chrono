import type { ProjectReferral } from './project-referral.entity';

/** Sum of active referral percentages on a project. */
export function referralTotalPct(
  referrals: Array<Pick<ProjectReferral, 'percent'>>,
): number {
  return referrals.reduce((acc, r) => acc + (r.percent ?? 0), 0);
}

/** Percentage still assignable before hitting the 100% cap. */
export function remainingReferralPct(
  referrals: Array<Pick<ProjectReferral, 'percent'>>,
): number {
  return Math.max(0, 100 - referralTotalPct(referrals));
}

/** Referral payout (cents) for a given percent against a revenue base. */
export function referralCut(pct: number, revenueCents: number): number {
  return Math.round((revenueCents * pct) / 100);
}
