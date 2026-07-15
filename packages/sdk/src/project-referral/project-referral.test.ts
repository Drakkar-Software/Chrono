import { describe, expect, it } from 'vitest';
import {
  referralCut,
  referralTotalPct,
  remainingReferralPct,
} from './project-referral.lib';

describe('referralTotalPct', () => {
  it('sums percentages', () => {
    expect(referralTotalPct([{ percent: 30 }, { percent: 20 }])).toBe(50);
  });

  it('ignores rows with a null percent', () => {
    expect(
      referralTotalPct([{ percent: 40 }, { percent: null }, { percent: 10 }]),
    ).toBe(50);
  });

  it('is 0 for an empty list', () => {
    expect(referralTotalPct([])).toBe(0);
  });
});

describe('remainingReferralPct', () => {
  it('two referrers summing to 100 leave 0 remaining', () => {
    expect(remainingReferralPct([{ percent: 60 }, { percent: 40 }])).toBe(0);
  });

  it('floors at 0 when the sum exceeds 100 (<=100% invariant)', () => {
    expect(remainingReferralPct([{ percent: 80 }, { percent: 50 }])).toBe(0);
  });

  it('is the full 100 for an empty list', () => {
    expect(remainingReferralPct([])).toBe(100);
  });

  it('ignores null percents when computing the remainder', () => {
    expect(
      remainingReferralPct([{ percent: 25 }, { percent: null }]),
    ).toBe(75);
  });
});

describe('referralCut', () => {
  it('computes round(revenueCents * pct / 100)', () => {
    expect(referralCut(10, 370000)).toBe(37000);
    expect(referralCut(0, 370000)).toBe(0);
    expect(referralCut(100, 370000)).toBe(370000);
  });

  it('rounds to whole cents', () => {
    // 370000 * 33.333 / 100 = 123332.1 -> 123332
    expect(referralCut(33.333, 370000)).toBe(123332);
    // half-up boundary
    expect(referralCut(50, 3)).toBe(2);
  });
});
