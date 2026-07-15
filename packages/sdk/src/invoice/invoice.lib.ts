import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from '../constants';
import type { InvoiceStatus } from '../schema';
import type { Invoice } from './invoice.entity';

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export function invoiceStatusLabel(status: InvoiceStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * A "real", money-bearing invoice — submitted and beyond. Excludes `draft`
 * (not yet a claim) and `cancelled` (which retains frozen earned/due amounts in
 * the DB but represents no money owed). Use this to gate any cross-invoice
 * money aggregation so cancelled/draft rows don't inflate totals.
 */
export function isActiveInvoice(status: InvoiceStatus): boolean {
  return status === 'submitted' || status === 'partially_paid' || status === 'paid';
}

/** Human label for an invoice: its assigned number, else the period (draft). */
export function invoiceLabel(
  invoice: Pick<Invoice, 'invoice_number' | 'period_month'>,
): string {
  if (invoice.invoice_number) return invoice.invoice_number;
  return invoice.period_month.slice(0, 7);
}

/** Format integer cents as a localized currency string. */
export function formatMoney(
  cents: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export type VatBreakdown = {
  /** Applied VAT rate as a percentage (0 when none). */
  rate: number;
  netCents: number;
  taxCents: number;
  grossCents: number;
};

/**
 * VAT breakdown for a net amount. A null/zero rate yields zero tax (gross = net),
 * so callers can render the same structure whether or not VAT applies.
 */
export function vatBreakdown(
  netCents: number,
  rate: number | null | undefined,
): VatBreakdown {
  const r = rate != null && rate > 0 ? rate : 0;
  const taxCents = Math.round((netCents * r) / 100);
  return { rate: r, netCents, taxCents, grossCents: netCents + taxCents };
}

/** Whether an invoice carries a VAT rate worth rendering. */
export function hasVat(invoice: Pick<Invoice, 'vat_rate'>): boolean {
  return invoice.vat_rate != null && invoice.vat_rate > 0;
}

export type InvoiceAmounts = {
  earnedCents: number;
  creditBroughtForwardCents: number;
  amountDueCents: number;
  amountPaidCents: number;
  creditCarriedForwardCents: number;
  /** Still owed on this invoice after payments. */
  outstandingCents: number;
};

/** Breakdown of an invoice's money fields (cents). */
export function invoiceAmounts(
  invoice: Pick<
    Invoice,
    | 'earned_cents'
    | 'credit_brought_forward_cents'
    | 'amount_due_cents'
    | 'amount_paid_cents'
    | 'credit_carried_forward_cents'
  >,
): InvoiceAmounts {
  const amountDue = invoice.amount_due_cents ?? 0;
  const amountPaid = invoice.amount_paid_cents ?? 0;
  return {
    earnedCents: invoice.earned_cents ?? 0,
    creditBroughtForwardCents: invoice.credit_brought_forward_cents ?? 0,
    amountDueCents: amountDue,
    amountPaidCents: amountPaid,
    creditCarriedForwardCents: invoice.credit_carried_forward_cents ?? 0,
    outstandingCents: Math.max(0, amountDue - amountPaid),
  };
}

type OutstandingInvoice = Pick<
  Invoice,
  | 'project_id'
  | 'freelancer_id'
  | 'period_month'
  | 'status'
  | 'amount_due_cents'
  | 'amount_paid_cents'
>;

/**
 * Total money still owed across a set of invoices, correct under FIFO
 * carry-forward. Each freelancer×project stream chains its shortfall into the
 * NEXT month's invoice (that month's `amount_due` re-includes the prior
 * carried amount), so summing every invoice's outstanding double-counts the
 * chain. Instead, take only the latest invoice per stream — it already
 * accumulates the whole chain — and only when it's still owed
 * (submitted / partially_paid). Cancelled, draft and fully-paid streams
 * contribute nothing.
 */
export function totalOutstanding(invoices: OutstandingInvoice[]): number {
  const latest = new Map<string, OutstandingInvoice>();
  for (const inv of invoices) {
    const key = `${inv.project_id}:${inv.freelancer_id}`;
    const cur = latest.get(key);
    if (!cur || inv.period_month > cur.period_month) latest.set(key, inv);
  }
  let total = 0;
  for (const inv of latest.values()) {
    if (inv.status === 'submitted' || inv.status === 'partially_paid') {
      total += Math.max(0, (inv.amount_due_cents ?? 0) - (inv.amount_paid_cents ?? 0));
    }
  }
  return total;
}
