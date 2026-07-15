import { describe, expect, it } from 'vitest';
import type { RevenueSource } from './revenue-source.entity';
import {
  monthlyRecurringAmount,
  revenueSourceLabel,
  sourceClientTjm,
} from './revenue-source.lib';

// Minimal helper: only `type` and `content` are read by these functions.
function src(
  type: RevenueSource['type'],
  content: unknown,
): Pick<RevenueSource, 'type' | 'content'> {
  return { type, content: content as RevenueSource['content'] };
}

describe('revenueSourceLabel', () => {
  it('labels every source type', () => {
    expect(revenueSourceLabel('time_based')).toBe('Time-based');
    expect(revenueSourceLabel('recurring')).toBe('Recurring');
    expect(revenueSourceLabel('self_billing')).toBe('Self-billing');
  });
});

describe('sourceClientTjm', () => {
  it('reads client_tjm_cents for time_based sources', () => {
    expect(sourceClientTjm(src('time_based', { client_tjm_cents: 60000 }))).toBe(
      60000,
    );
  });

  it('reads client_tjm_cents for self_billing sources', () => {
    expect(
      sourceClientTjm(src('self_billing', { client_tjm_cents: 75000 })),
    ).toBe(75000);
  });

  it('is 0 for a recurring source regardless of content', () => {
    expect(
      sourceClientTjm(src('recurring', { monthly_amount_cents: 300000 })),
    ).toBe(0);
  });

  it('is 0 when content is null / empty / missing the key', () => {
    expect(sourceClientTjm(src('time_based', null))).toBe(0);
    expect(sourceClientTjm(src('time_based', {}))).toBe(0);
    expect(sourceClientTjm(src('time_based', { markup_pct: 10 }))).toBe(0);
  });
});

describe('monthlyRecurringAmount', () => {
  it('reads monthly_amount_cents for recurring sources', () => {
    expect(
      monthlyRecurringAmount(src('recurring', { monthly_amount_cents: 300000 })),
    ).toBe(300000);
  });

  it('is 0 for non-recurring sources', () => {
    expect(
      monthlyRecurringAmount(src('time_based', { client_tjm_cents: 60000 })),
    ).toBe(0);
    expect(
      monthlyRecurringAmount(src('self_billing', { client_tjm_cents: 60000 })),
    ).toBe(0);
  });

  it('is 0 when content is null / empty / missing the key', () => {
    expect(monthlyRecurringAmount(src('recurring', null))).toBe(0);
    expect(monthlyRecurringAmount(src('recurring', {}))).toBe(0);
    expect(monthlyRecurringAmount(src('recurring', { other: 1 }))).toBe(0);
  });
});
