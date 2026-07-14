import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesUpdate } from '../schema';
import { fetchMonthEntriesForInvoice } from '../time-entry/time-entry.queries';
import { computeEarnedCents, monthKey } from '../time-entry/time-entry.lib';
import type {
  Invoice,
  InvoiceFilters,
  InvoiceWithRelations,
} from './invoice.entity';

type Client = SupabaseClient<Database>;

export const INVOICE_SELECT = `
  *,
  project:projects(name),
  freelancer:profiles(full_name)
` as const;

export async function fetchInvoices(
  client: Client,
  filters: InvoiceFilters,
): Promise<InvoiceWithRelations[]> {
  let query = client
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('company_id', filters.companyId)
    .eq('deleted', false)
    .order('period_month', { ascending: false });

  if (filters.freelancerId)
    query = query.eq('freelancer_id', filters.freelancerId);
  if (filters.projectId) query = query.eq('project_id', filters.projectId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.month) query = query.eq('period_month', monthKey(filters.month));

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as InvoiceWithRelations[];
}

export async function fetchInvoice(
  client: Client,
  id: string,
): Promise<InvoiceWithRelations> {
  const { data, error } = await client
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as InvoiceWithRelations;
}

/**
 * Credit carried forward by the freelancer's latest settled invoice on a
 * project, i.e. what they should bring forward onto the next invoice. 0 if none.
 */
export async function fetchOutstandingCredit(
  client: Client,
  params: { projectId: string; freelancerId: string },
): Promise<number> {
  const { data, error } = await client
    .from('invoices')
    .select('credit_carried_forward_cents')
    .eq('project_id', params.projectId)
    .eq('freelancer_id', params.freelancerId)
    .not('settled_at', 'is', null)
    .eq('deleted', false)
    .order('period_month', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.credit_carried_forward_cents ?? 0;
}

/**
 * Build a draft invoice for a freelancer/project/month by aggregating their
 * approved billable uninvoiced time and carrying forward outstanding credit.
 */
export async function generateInvoice(
  client: Client,
  params: {
    projectId: string;
    freelancerId: string;
    companyId: string;
    month: string;
    tjmCents: number;
    hoursPerDay: number;
  },
): Promise<Invoice> {
  const period = monthKey(params.month);

  const entries = await fetchMonthEntriesForInvoice(client, {
    projectId: params.projectId,
    userId: params.freelancerId,
    month: period,
  });
  const workedMinutes = entries.reduce(
    (acc, e) => acc + (e.duration_minutes ?? 0),
    0,
  );
  const earnedCents = computeEarnedCents(
    workedMinutes,
    params.hoursPerDay,
    params.tjmCents,
  );
  const creditBroughtForward = await fetchOutstandingCredit(client, {
    projectId: params.projectId,
    freelancerId: params.freelancerId,
  });
  const amountDue = earnedCents + creditBroughtForward;

  const { data, error } = await client
    .from('invoices')
    .insert({
      company_id: params.companyId,
      project_id: params.projectId,
      freelancer_id: params.freelancerId,
      period_month: period,
      worked_minutes: workedMinutes,
      tjm_cents: params.tjmCents,
      hours_per_day: params.hoursPerDay,
      earned_cents: earnedCents,
      credit_brought_forward_cents: creditBroughtForward,
      amount_due_cents: amountDue,
      status: 'draft',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Invoice;
}

export async function updateInvoice(
  client: Client,
  id: string,
  patch: TablesUpdate<'invoices'>,
): Promise<Invoice> {
  const { data, error } = await client
    .from('invoices')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Invoice;
}

export async function submitInvoice(
  client: Client,
  id: string,
): Promise<Invoice> {
  const { data, error } = await client
    .from('invoices')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Invoice;
}

export async function cancelInvoice(
  client: Client,
  id: string,
): Promise<Invoice> {
  const { data, error } = await client
    .from('invoices')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Invoice;
}

/** Settle a project's month (recognizes revenue, pays referrals, settles FIFO). */
export async function settleProjectMonth(
  client: Client,
  projectId: string,
  month: string,
): Promise<void> {
  const { error } = await client.rpc('settle_project_month', {
    p_project_id: projectId,
    p_period: monthKey(month),
  });
  if (error) throw error;
}
