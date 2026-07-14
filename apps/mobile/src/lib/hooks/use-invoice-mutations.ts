import { globalSupabaseClient } from '@/lib/supabase';
import { stores } from '@/lib/supabase-stores';
import {
  cancelInvoice,
  generateInvoice,
  settleProjectMonth,
  submitInvoice,
} from '@chrono/sdk';
import type { Invoice } from '@chrono/sdk';
import { useAsyncAction } from './use-async-action';

type GenerateParams = {
  projectId: string;
  freelancerId: string;
  companyId: string;
  month: string;
  tjmCents: number;
  hoursPerDay: number;
};

/**
 * Write a raw invoice row returned by an SDK mutation into the anchor store.
 * Merging bumps the `invoices` store version, which makes every linked query
 * (single `useInvoice` reads and the `useInvoices` lists) re-fetch — otherwise
 * the DB triggers rewrite the money and the UI keeps showing stale status.
 */
function mergeInvoice(invoice: Invoice) {
  stores.invoices.getState().mergeRecords([invoice]);
}

/** Build a draft invoice for a freelancer/project/month. */
export function useGenerateInvoice() {
  return useAsyncAction(async (params: GenerateParams) => {
    const invoice = await generateInvoice(globalSupabaseClient, params);
    mergeInvoice(invoice);
    return invoice;
  });
}

export function useSubmitInvoice() {
  return useAsyncAction(async (id: string) => {
    const invoice = await submitInvoice(globalSupabaseClient, id);
    mergeInvoice(invoice);
    return invoice;
  });
}

export function useCancelInvoice() {
  return useAsyncAction(async (id: string) => {
    const invoice = await cancelInvoice(globalSupabaseClient, id);
    mergeInvoice(invoice);
    return invoice;
  });
}

/**
 * Settle a project's month (recognizes revenue, pays referrals, settles FIFO).
 * The RPC flips many invoices to paid and writes referral_earnings +
 * revenue_entries the client never sees, so callers must refetch the affected
 * `useInvoices` / `useReferralEarnings` / `useRevenueEntries` queries after this
 * resolves. Bumping the invoices store here also nudges linked invoice queries.
 */
export function useSettleProjectMonth() {
  return useAsyncAction(async (projectId: string, month: string) => {
    await settleProjectMonth(globalSupabaseClient, projectId, month);
    // No rows are returned; bump the store so linked invoice queries re-pull.
    stores.invoices.getState().mergeRecords([]);
  });
}
