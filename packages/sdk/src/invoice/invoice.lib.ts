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
