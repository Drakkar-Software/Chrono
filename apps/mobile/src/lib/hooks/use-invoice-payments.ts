import { useCallback } from 'react';
import { useLinkedQuery, useMutation } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchInvoicePayments } from '@chrono/sdk';
import type { InvoicePayment } from '@chrono/sdk';

/** Manual payments recorded against an invoice, offline-first. */
export function useInvoicePayments(invoiceId: string | undefined) {
  return useLinkedQuery(() => fetchInvoicePayments(globalSupabaseClient, invoiceId!), {
    stores: [stores.invoice_payments],
    enabled: !!invoiceId,
    deps: [invoiceId],
    staleTime: 30_000,
    queryKey: `invoice-payments:${invoiceId}`,
  }) as {
    data: InvoicePayment[] | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => Promise<void>;
  };
}

export function useInvoicePaymentMutations() {
  const { insert, update, isLoading, error } = useMutation(stores.invoice_payments);

  const record = useCallback(
    (input: {
      invoiceId: string;
      companyId: string;
      amountCents: number;
      paidOn: string;
      method: string | null;
      note: string | null;
      recordedBy: string;
    }) =>
      insert({
        invoice_id: input.invoiceId,
        company_id: input.companyId,
        amount_cents: input.amountCents,
        paid_on: input.paidOn,
        method: input.method,
        note: input.note,
        recorded_by: input.recordedBy,
      }),
    [insert],
  );
  const remove = useCallback((id: string) => update(id, { deleted: true }), [update]);

  return { record, remove, isPending: isLoading, error };
}
