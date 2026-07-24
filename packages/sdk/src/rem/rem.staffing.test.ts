import { describe, expect, it } from 'vitest';
import { staffingTjmRemCents } from './rem.lib';
import { computeEarnedCents } from '../time-entry/time-entry.lib';
import { availableFunding } from '../revenue-entry/revenue-entry.lib';
import { referralCut } from '../project-referral/project-referral.lib';

describe('staffing regression', () => {
  it('H2 staffing rem equals computeEarnedCents for common day lengths', () => {
    for (const [min, hpd, tjm] of [
      [420, 7, 50_000],
      [480, 8, 80_000],
      [210, 7, 100_000],
      [0, 7, 50_000],
    ] as const) {
      expect(staffingTjmRemCents(min, hpd, tjm)).toBe(
        computeEarnedCents(min, hpd, tjm),
      );
    }
  });

  it('H4 referral first-claim still reduces funding like legacy', () => {
    const revenue = 370_000;
    const cut = referralCut(10, revenue);
    expect(cut).toBe(37_000);
    const funding = availableFunding(
      [{ amount_cents: revenue, paid_at: '2026-01-15' }],
      [{ amount_cents: cut }],
      [],
    );
    expect(funding).toBe(333_000);
  });
});
