import { globalSupabaseClient } from '@/lib/supabase';
import {
  cancelInvoice,
  generateInvoice,
  settleProjectMonth,
  submitInvoice,
} from '@chrono/sdk';
import { useAsyncAction } from './use-async-action';

type GenerateParams = {
  projectId: string;
  freelancerId: string;
  companyId: string;
  month: string;
  tjmCents: number;
  hoursPerDay: number;
};

/** Build a draft invoice for a freelancer/project/month. */
export function useGenerateInvoice() {
  return useAsyncAction((params: GenerateParams) =>
    generateInvoice(globalSupabaseClient, params),
  );
}

export function useSubmitInvoice() {
  return useAsyncAction((id: string) => submitInvoice(globalSupabaseClient, id));
}

export function useCancelInvoice() {
  return useAsyncAction((id: string) => cancelInvoice(globalSupabaseClient, id));
}

/** Settle a project's month (recognizes revenue, pays referrals, settles FIFO). */
export function useSettleProjectMonth() {
  return useAsyncAction((projectId: string, month: string) =>
    settleProjectMonth(globalSupabaseClient, projectId, month),
  );
}
