import { describe, expect, it } from 'vitest';
import type { InvoiceStatus } from '../schema';
import type { Invoice } from './invoice.entity';
import {
  approvedUnpaidCents,
  formatMoney,
  invoiceAmounts,
  invoiceStatusLabel,
  isActiveInvoice,
  totalOutstanding,
} from './invoice.lib';

// Minimal invoice-shaped fixture — only the fields totalOutstanding /
// approvedUnpaidCents read.
type OutInv = Pick<
  Invoice,
  | 'project_id'
  | 'freelancer_id'
  | 'period_month'
  | 'status'
  | 'amount_due_cents'
  | 'amount_paid_cents'
>;
function inv(
  project_id: string,
  freelancer_id: string,
  period_month: string,
  status: InvoiceStatus,
  amount_due_cents: number,
  amount_paid_cents: number,
): OutInv {
  return {
    project_id,
    freelancer_id,
    period_month,
    status,
    amount_due_cents,
    amount_paid_cents,
  };
}

describe('formatMoney', () => {
  it('formats integer cents as currency (deterministic en-US locale)', () => {
    expect(formatMoney(123456, 'USD', 'en-US')).toBe('$1,234.56');
    expect(formatMoney(0, 'USD', 'en-US')).toBe('$0.00');
    expect(formatMoney(50000, 'USD', 'en-US')).toBe('$500.00');
  });
});

describe('invoiceStatusLabel', () => {
  it('labels every status', () => {
    expect(invoiceStatusLabel('partially_paid')).toBe('Partially paid');
    expect(invoiceStatusLabel('paid')).toBe('Paid');
  });
});

describe('invoiceAmounts', () => {
  it('breaks down money fields and computes outstanding', () => {
    const amounts = invoiceAmounts({
      earned_cents: 500000,
      credit_brought_forward_cents: 20000,
      amount_due_cents: 520000,
      amount_paid_cents: 300000,
      credit_carried_forward_cents: 220000,
    });
    expect(amounts).toEqual({
      earnedCents: 500000,
      creditBroughtForwardCents: 20000,
      amountDueCents: 520000,
      amountPaidCents: 300000,
      creditCarriedForwardCents: 220000,
      outstandingCents: 220000,
    });
  });

  it('asserts carry math: due = earned + brought-forward, carried = due - paid', () => {
    // A partially-funded invoice: earned 500000 + 20000 credit = 520000 due,
    // paid 300000, so 220000 carries forward and 220000 remains outstanding.
    const earned = 500000;
    const brought = 20000;
    const due = earned + brought;
    const paid = 300000;
    const carried = due - paid;
    const amounts = invoiceAmounts({
      earned_cents: earned,
      credit_brought_forward_cents: brought,
      amount_due_cents: due,
      amount_paid_cents: paid,
      credit_carried_forward_cents: carried,
    });
    expect(amounts.amountDueCents).toBe(520000);
    expect(amounts.creditCarriedForwardCents).toBe(carried);
    expect(amounts.outstandingCents).toBe(carried);
  });

  it('never reports negative outstanding when overpaid', () => {
    const amounts = invoiceAmounts({
      earned_cents: 100000,
      credit_brought_forward_cents: 0,
      amount_due_cents: 100000,
      amount_paid_cents: 120000,
      credit_carried_forward_cents: 0,
    });
    expect(amounts.outstandingCents).toBe(0);
  });
});

describe('isActiveInvoice', () => {
  it('is true for money-bearing statuses', () => {
    expect(isActiveInvoice('submitted')).toBe(true);
    expect(isActiveInvoice('partially_paid')).toBe(true);
    expect(isActiveInvoice('paid')).toBe(true);
  });

  it('is false for draft and cancelled', () => {
    expect(isActiveInvoice('draft')).toBe(false);
    expect(isActiveInvoice('cancelled')).toBe(false);
  });
});

describe('totalOutstanding', () => {
  it('(a) sums a single submitted invoice outstanding', () => {
    expect(
      totalOutstanding([inv('p', 'f', '2026-01-01', 'submitted', 1000, 0)]),
    ).toBe(1000);
  });

  it('(b) takes the latest month per stream — the carry chain is not double-counted', () => {
    // Same project+freelancer stream. Month2 already re-includes the carry, so
    // the total is month2's outstanding (400), NOT 400 + 400.
    const invoices = [
      inv('p', 'f', '2026-01-01', 'partially_paid', 1000, 600),
      inv('p', 'f', '2026-02-01', 'submitted', 400, 0),
    ];
    expect(totalOutstanding(invoices)).toBe(400);
  });

  it('(c) a cancelled latest invoice contributes 0', () => {
    expect(
      totalOutstanding([inv('p', 'f', '2026-01-01', 'cancelled', 1000, 0)]),
    ).toBe(0);
  });

  it('(d) a fully-paid latest invoice contributes 0', () => {
    expect(
      totalOutstanding([inv('p', 'f', '2026-01-01', 'paid', 1000, 1000)]),
    ).toBe(0);
  });

  it('(e) sums two distinct streams independently', () => {
    const invoices = [
      inv('p1', 'f1', '2026-01-01', 'submitted', 1000, 200), // 800
      inv('p2', 'f2', '2026-01-01', 'partially_paid', 500, 100), // 400
    ];
    expect(totalOutstanding(invoices)).toBe(1200);
  });

  it('distinguishes streams by both project and freelancer', () => {
    // Same freelancer, two projects -> two streams, both count.
    const invoices = [
      inv('p1', 'f', '2026-01-01', 'submitted', 300, 0),
      inv('p2', 'f', '2026-01-01', 'submitted', 700, 0),
    ];
    expect(totalOutstanding(invoices)).toBe(1000);
  });

  it('is 0 for an empty list', () => {
    expect(totalOutstanding([])).toBe(0);
  });

  it('a draft-only latest invoice contributes 0 — this is the "impayé" bug approvedUnpaidCents fixes', () => {
    expect(
      totalOutstanding([inv('p', 'f', '2026-01-01', 'draft', 1000, 0)]),
    ).toBe(0);
  });
});

describe('approvedUnpaidCents', () => {
  it('agrees with totalOutstanding for a plain submitted invoice', () => {
    const invoices = [inv('p', 'f', '2026-01-01', 'submitted', 1000, 0)];
    expect(approvedUnpaidCents(invoices)).toBe(totalOutstanding(invoices));
  });

  it('includes a draft invoice, unlike totalOutstanding', () => {
    const invoices = [inv('p', 'f', '2026-01-01', 'draft', 1000, 0)];
    expect(totalOutstanding(invoices)).toBe(0);
    expect(approvedUnpaidCents(invoices)).toBe(1000);
  });

  it('nets a partial payment on a draft invoice', () => {
    const invoices = [inv('p', 'f', '2026-01-01', 'draft', 1000, 400)];
    expect(approvedUnpaidCents(invoices)).toBe(600);
  });

  it('still excludes a cancelled or fully-paid latest invoice', () => {
    expect(approvedUnpaidCents([inv('p', 'f', '2026-01-01', 'cancelled', 1000, 0)])).toBe(0);
    expect(approvedUnpaidCents([inv('p', 'f', '2026-01-01', 'paid', 1000, 1000)])).toBe(0);
  });

  it('applies the same latest-per-stream FIFO rule as totalOutstanding', () => {
    const invoices = [
      inv('p', 'f', '2026-01-01', 'partially_paid', 1000, 600),
      inv('p', 'f', '2026-02-01', 'draft', 400, 0),
    ];
    expect(approvedUnpaidCents(invoices)).toBe(400);
  });

  it('values uninvoiced approved entries at the day rate (minutes -> days -> cents)', () => {
    // 420 minutes at 7h/day = exactly 1 day; 1 day * 50000 cents = 50000.
    const entries = [{ project_id: 'p', duration_minutes: 420, hours_per_day: 7, rate_cents: 50000 }];
    expect(approvedUnpaidCents([], entries)).toBe(50000);
  });

  it('combines invoice outstanding and uninvoiced entries without double counting', () => {
    const invoices = [inv('p', 'f', '2026-01-01', 'draft', 1000, 0)];
    const entries = [{ project_id: 'p2', duration_minutes: 420, hours_per_day: 7, rate_cents: 50000 }];
    expect(approvedUnpaidCents(invoices, entries)).toBe(51000);
  });

  it('a zero-rate entry contributes 0', () => {
    const entries = [{ project_id: 'p', duration_minutes: 420, hours_per_day: 7, rate_cents: 0 }];
    expect(approvedUnpaidCents([], entries)).toBe(0);
  });

  it('sums multiple uninvoiced entries across different projects', () => {
    const entries = [
      { project_id: 'p1', duration_minutes: 420, hours_per_day: 7, rate_cents: 50000 }, // 1 day -> 50000
      { project_id: 'p2', duration_minutes: 240, hours_per_day: 8, rate_cents: 40000 }, // 0.5 day -> 20000
    ];
    expect(approvedUnpaidCents([], entries)).toBe(70000);
  });

  it('is 0 for no invoices and no entries', () => {
    expect(approvedUnpaidCents([])).toBe(0);
    expect(approvedUnpaidCents([], [])).toBe(0);
  });
});
