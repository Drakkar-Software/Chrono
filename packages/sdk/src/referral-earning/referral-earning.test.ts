import { describe, expect, it } from 'vitest';
import { referralAmount, sumReferralEarnings } from './referral-earning.lib';

describe('referralAmount', () => {
  it('matches the README worked example', () => {
    // 10% of 370000 cents = 37000 cents.
    expect(referralAmount(10, 370000)).toBe(37000);
  });

  it('is 0 at 0%', () => {
    expect(referralAmount(0, 370000)).toBe(0);
  });

  it('returns the full base at 100%', () => {
    expect(referralAmount(100, 370000)).toBe(370000);
  });

  it('rounds fractional percentages to whole cents', () => {
    // 370000 * 33.333 / 100 = 123332.1 -> 123332
    expect(referralAmount(33.333, 370000)).toBe(123332);
  });

  it('rounds a half-cent boundary up (Math.round is half-up)', () => {
    // 1 * 50 / 100 = 0.5 -> 1
    expect(referralAmount(50, 1)).toBe(1);
    // 3 * 50 / 100 = 1.5 -> 2
    expect(referralAmount(50, 3)).toBe(2);
  });

  it('is 0 for a 0 base', () => {
    expect(referralAmount(50, 0)).toBe(0);
  });

  it('allows a negative base (no guard) and returns a negative amount', () => {
    expect(referralAmount(10, -370000)).toBe(-37000);
  });

  it('does NOT cap above 100% — returns more than the base', () => {
    // No >100% guard: 370000 * 150 / 100 = 555000, which exceeds the base.
    // Documenting actual behavior (candidate bug — see report).
    expect(referralAmount(150, 370000)).toBe(555000);
  });
});

describe('sumReferralEarnings', () => {
  it('sums amount_cents, treating null as 0', () => {
    expect(
      sumReferralEarnings([
        { amount_cents: 1000 },
        { amount_cents: 2500 },
        { amount_cents: null as unknown as number },
      ]),
    ).toBe(3500);
    expect(sumReferralEarnings([])).toBe(0);
  });
});
