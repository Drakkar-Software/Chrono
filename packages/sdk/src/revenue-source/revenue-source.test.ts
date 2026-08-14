import { describe, expect, it } from 'vitest';
import type { RevenueSource } from './revenue-source.entity';
import {
  occurrencesInMonth,
  recurringSchedule,
  revenueSourceInactive,
  revenueSourceLabel,
  sourceClientTjm,
  sourceHeadlineAmount,
  sourceManualAmount,
  sourceManualDays,
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

describe('recurringSchedule', () => {
  it('reads frequency + per-occurrence amount from a scheduled source', () => {
    expect(
      recurringSchedule(src('recurring', { frequency: 'weekly', amount_cents: 50000 })),
    ).toEqual({ frequency: 'weekly', amountCents: 50000 });
  });

  it('falls back to the flat monthly figure for a legacy source', () => {
    expect(
      recurringSchedule(src('recurring', { monthly_amount_cents: 300000 })),
    ).toEqual({ frequency: null, amountCents: 300000 });
  });

  it('is empty for non-recurring sources', () => {
    expect(recurringSchedule(src('time_based', { client_tjm_cents: 60000 }))).toEqual({
      frequency: null,
      amountCents: 0,
    });
    expect(recurringSchedule(src('self_billing', { client_tjm_cents: 60000 }))).toEqual({
      frequency: null,
      amountCents: 0,
    });
  });

  it('is 0 when content is null / empty / missing the key', () => {
    expect(recurringSchedule(src('recurring', null)).amountCents).toBe(0);
    expect(recurringSchedule(src('recurring', {})).amountCents).toBe(0);
    expect(recurringSchedule(src('recurring', { other: 1 })).amountCents).toBe(0);
  });
});

describe('occurrencesInMonth', () => {
  // 2026-03-11 is a Wednesday; March 2026 has 31 days, April 30, and 2026 is
  // not a leap year.
  it('counts weekly occurrences from the anchor', () => {
    // Mar 11, 18, 25
    expect(occurrencesInMonth('weekly', '2026-03-11', null, '2026-03-01')).toBe(3);
    // Apr 1, 8, 15, 22, 29
    expect(occurrencesInMonth('weekly', '2026-03-11', null, '2026-04-01')).toBe(5);
  });

  it('counts biweekly occurrences from the anchor', () => {
    // Mar 11, 25
    expect(occurrencesInMonth('biweekly', '2026-03-11', null, '2026-03-01')).toBe(2);
    // Apr 8, 22
    expect(occurrencesInMonth('biweekly', '2026-03-11', null, '2026-04-01')).toBe(2);
  });

  it('counts calendar days for daily, weekends included', () => {
    // Mar 11..31 inclusive
    expect(occurrencesInMonth('daily', '2026-03-11', null, '2026-03-01')).toBe(21);
    // A whole month once the schedule has started
    expect(occurrencesInMonth('daily', '2026-03-11', null, '2026-04-01')).toBe(30);
  });

  it('gives a monthly schedule one occurrence per month from the start', () => {
    expect(occurrencesInMonth('monthly', '2026-03-15', null, '2026-03-01')).toBe(1);
    expect(occurrencesInMonth('monthly', '2026-03-15', null, '2026-04-01')).toBe(1);
  });

  it('clamps a month-end anchor to shorter months', () => {
    // A 31st anchor lands on Feb 28 in a non-leap year, not nowhere.
    expect(occurrencesInMonth('monthly', '2026-01-31', null, '2026-02-01')).toBe(1);
    // ...and on Feb 29 in a leap year.
    expect(occurrencesInMonth('monthly', '2028-01-31', null, '2028-02-01')).toBe(1);
  });

  it('skips off-cycle months for quarterly and yearly', () => {
    expect(occurrencesInMonth('quarterly', '2026-03-15', null, '2026-03-01')).toBe(1);
    expect(occurrencesInMonth('quarterly', '2026-03-15', null, '2026-04-01')).toBe(0);
    expect(occurrencesInMonth('quarterly', '2026-03-15', null, '2026-06-01')).toBe(1);
    expect(occurrencesInMonth('yearly', '2026-03-15', null, '2026-03-01')).toBe(1);
    expect(occurrencesInMonth('yearly', '2026-03-15', null, '2026-04-01')).toBe(0);
    expect(occurrencesInMonth('yearly', '2026-03-15', null, '2027-03-01')).toBe(1);
  });

  it('is 0 before the schedule starts', () => {
    expect(occurrencesInMonth('monthly', '2026-05-01', null, '2026-04-01')).toBe(0);
    expect(occurrencesInMonth('weekly', '2026-05-01', null, '2026-04-01')).toBe(0);
    expect(occurrencesInMonth('daily', '2026-05-01', null, '2026-04-01')).toBe(0);
  });

  it('truncates at the end date', () => {
    // Mar 11, 18 — the 25th is past the end.
    expect(occurrencesInMonth('weekly', '2026-03-11', '2026-03-20', '2026-03-01')).toBe(2);
    expect(occurrencesInMonth('daily', '2026-03-01', '2026-03-10', '2026-03-01')).toBe(10);
    expect(occurrencesInMonth('monthly', '2026-03-15', '2026-03-31', '2026-04-01')).toBe(0);
  });
});

describe('sourceManualAmount', () => {
  it('reads manual_amount_cents for a time_based source with an override', () => {
    expect(
      sourceManualAmount(
        src('time_based', { client_tjm_cents: 50000, manual_amount_cents: 500000, manual_days: 10 }),
      ),
    ).toBe(500000);
  });

  it('is undefined for a time_based source with no override', () => {
    expect(sourceManualAmount(src('time_based', { client_tjm_cents: 50000 }))).toBeUndefined();
  });

  it('is undefined for non-time_based sources', () => {
    expect(
      sourceManualAmount(src('recurring', { monthly_amount_cents: 300000 })),
    ).toBeUndefined();
    expect(
      sourceManualAmount(src('self_billing', { client_tjm_cents: 50000, manual_amount_cents: 500000 })),
    ).toBeUndefined();
  });
});

describe('sourceManualDays', () => {
  it('reads manual_days for a time_based source with an override', () => {
    expect(
      sourceManualDays(src('time_based', { client_tjm_cents: 50000, manual_amount_cents: 500000, manual_days: 10 })),
    ).toBe(10);
  });

  it('is undefined when there is no override or the source is not time_based', () => {
    expect(sourceManualDays(src('time_based', { client_tjm_cents: 50000 }))).toBeUndefined();
    expect(
      sourceManualDays(src('recurring', { monthly_amount_cents: 300000 })),
    ).toBeUndefined();
  });
});

describe('sourceHeadlineAmount', () => {
  it('uses the per-occurrence amount for recurring', () => {
    expect(
      sourceHeadlineAmount(src('recurring', { frequency: 'weekly', amount_cents: 50000 })),
    ).toBe(50000);
  });

  it('uses the flat monthly amount for a legacy recurring source', () => {
    expect(sourceHeadlineAmount(src('recurring', { monthly_amount_cents: 300000 }))).toBe(300000);
  });

  it('prefers manual override over client TJM for time_based', () => {
    expect(
      sourceHeadlineAmount(
        src('time_based', { client_tjm_cents: 50000, manual_amount_cents: 400000 }),
      ),
    ).toBe(400000);
  });

  it('falls back to client TJM when there is no manual override', () => {
    expect(sourceHeadlineAmount(src('time_based', { client_tjm_cents: 60000 }))).toBe(60000);
  });
});

describe('revenueSourceInactive', () => {
  it('is true only when active is false', () => {
    expect(revenueSourceInactive({ active: false })).toBe(true);
    expect(revenueSourceInactive({ active: true })).toBe(false);
  });
});
