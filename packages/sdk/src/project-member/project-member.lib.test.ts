import { describe, expect, it } from 'vitest';
import { effectiveTjm, valueUninvoicedTime } from './project-member.lib';

describe('effectiveTjm', () => {
  it("uses the member's own rate when set", () => {
    expect(effectiveTjm({ tjm_cents: 55000 }, { default_tjm_cents: 60000 })).toBe(55000);
  });

  it('falls back to the project default when the member has no rate', () => {
    expect(effectiveTjm({ tjm_cents: null }, { default_tjm_cents: 60000 })).toBe(60000);
  });

  it('falls back to 0 when neither the member nor the project has a rate', () => {
    expect(effectiveTjm(null, { default_tjm_cents: null })).toBe(0);
    expect(effectiveTjm(undefined, undefined)).toBe(0);
  });
});

const PROJECT = { default_tjm_cents: 60000, hours_per_day: 8 };

function entry(overrides: Partial<{
  user_id: string;
  duration_minutes: number;
  status: 'pending' | 'approved' | 'rejected';
  billable: boolean;
  invoice_id: string | null;
  deleted: boolean;
}> = {}) {
  return {
    user_id: 'u1',
    duration_minutes: 480, // 1 day at 8h/day
    status: 'approved' as const,
    billable: true,
    invoice_id: null,
    deleted: false,
    ...overrides,
  };
}

describe('valueUninvoicedTime', () => {
  it('values a single approved, billable, uninvoiced entry at the project default rate', () => {
    expect(valueUninvoicedTime([entry()], PROJECT, [])).toBe(60000);
  });

  it("uses the member's own tjm_cents override over the project default", () => {
    const total = valueUninvoicedTime(
      [entry()],
      PROJECT,
      [{ user_id: 'u1', tjm_cents: 50000 }],
    );
    expect(total).toBe(50000);
  });

  it('excludes pending entries', () => {
    expect(valueUninvoicedTime([entry({ status: 'pending' })], PROJECT, [])).toBe(0);
  });

  it('excludes rejected entries', () => {
    expect(valueUninvoicedTime([entry({ status: 'rejected' })], PROJECT, [])).toBe(0);
  });

  it('excludes non-billable entries', () => {
    expect(valueUninvoicedTime([entry({ billable: false })], PROJECT, [])).toBe(0);
  });

  it('excludes entries already attached to an invoice', () => {
    expect(valueUninvoicedTime([entry({ invoice_id: 'inv-1' })], PROJECT, [])).toBe(0);
  });

  it('excludes soft-deleted entries', () => {
    expect(valueUninvoicedTime([entry({ deleted: true })], PROJECT, [])).toBe(0);
  });

  it('groups minutes per user before valuing, matching server month-at-once rounding', () => {
    // 3 entries of 160 minutes each for the same user = 480 min = 1 day,
    // valued as one lump sum rather than three separately-rounded fragments.
    const total = valueUninvoicedTime(
      [
        entry({ duration_minutes: 160 }),
        entry({ duration_minutes: 160 }),
        entry({ duration_minutes: 160 }),
      ],
      PROJECT,
      [],
    );
    expect(total).toBe(60000);
  });

  it('values each user independently at their own effective rate', () => {
    const total = valueUninvoicedTime(
      [
        entry({ user_id: 'u1', duration_minutes: 480 }),
        entry({ user_id: 'u2', duration_minutes: 240 }),
      ],
      PROJECT,
      [{ user_id: 'u2', tjm_cents: 40000 }],
    );
    // u1: 1 day * 60000 (default) = 60000; u2: 0.5 day * 40000 (own rate) = 20000
    expect(total).toBe(80000);
  });

  it('is 0 for an empty entries list', () => {
    expect(valueUninvoicedTime([], PROJECT, [])).toBe(0);
  });

  it('is 0 when both the member and project have no rate', () => {
    expect(
      valueUninvoicedTime([entry()], { default_tjm_cents: null, hours_per_day: 8 }, []),
    ).toBe(0);
  });
});
