import { useLinkedQuery } from '@drakkar.software/anchor/hooks';
import { stores } from '@/lib/supabase-stores';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchInvoice, fetchInvoices } from '@chrono/sdk';
import type { InvoiceFilters, InvoiceWithRelations } from '@chrono/sdk';

type Refetch = () => Promise<void>;

export function useInvoices(filters: InvoiceFilters) {
  return useLinkedQuery(
    () => fetchInvoices(globalSupabaseClient, filters),
    {
      stores: [stores.invoices],
      enabled: !!filters.companyId,
      deps: [JSON.stringify(filters)],
      staleTime: 30_000,
      queryKey: `invoices:${JSON.stringify(filters)}`,
    },
  ) as { data: InvoiceWithRelations[] | undefined; isLoading: boolean; error: unknown; refetch: Refetch };
}

export function useInvoice(id: string | undefined) {
  return useLinkedQuery(
    () => fetchInvoice(globalSupabaseClient, id!),
    {
      stores: [stores.invoices],
      enabled: !!id,
      deps: [id],
      staleTime: 30_000,
      queryKey: `invoice:${id}`,
    },
  ) as { data: InvoiceWithRelations | undefined; isLoading: boolean; error: unknown; refetch: Refetch };
}
