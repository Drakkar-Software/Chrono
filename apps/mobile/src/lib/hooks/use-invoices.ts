import { linkedQuery } from './linked-query';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchInvoice, fetchInvoices } from '@chrono/sdk';
import type { InvoiceFilters, InvoiceWithRelations } from '@chrono/sdk';

export function useInvoices(filters: InvoiceFilters) {
  return linkedQuery<InvoiceWithRelations[]>(
    () => fetchInvoices(globalSupabaseClient, filters),
    {
      stores: [stores.invoices],
      enabled: !!filters.companyId,
      deps: [JSON.stringify(filters)],
      staleTime: 30_000,
      queryKey: `invoices:${JSON.stringify(filters)}`,
    },
  );
}

export function useInvoice(id: string | undefined) {
  return linkedQuery<InvoiceWithRelations>(
    () => fetchInvoice(globalSupabaseClient, id!),
    {
      stores: [stores.invoices],
      enabled: !!id,
      deps: [id],
      staleTime: 30_000,
      queryKey: `invoice:${id}`,
    },
  );
}
