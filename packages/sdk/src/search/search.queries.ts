import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../schema';
import type { Project } from '../project/project.entity';
import type { TimeEntryWithProject } from '../time-entry/time-entry.entity';
import type { InvoiceWithRelations } from '../invoice/invoice.entity';
import { TIME_ENTRY_SELECT } from '../time-entry/time-entry.queries';
import { INVOICE_SELECT } from '../invoice/invoice.queries';

type Client = SupabaseClient<Database>;

export interface SearchResults {
  projects: Project[];
  entries: TimeEntryWithProject[];
  invoices: InvoiceWithRelations[];
}

/** Strip PostgREST filter metacharacters so a term can't inject `.or()` clauses. */
function sanitize(term: string): string {
  return term.replace(/[,.()*:%]/g, ' ').trim();
}

/**
 * Search a company's projects, time entries and invoices for a term. RLS scopes
 * results (managers see all; freelancers see their own). Each entity is capped.
 */
export async function searchAll(
  client: Client,
  companyId: string,
  rawTerm: string,
): Promise<SearchResults> {
  const term = sanitize(rawTerm);
  if (!term) return { projects: [], entries: [], invoices: [] };
  const like = `%${term}%`;

  const [projects, entries, invoices] = await Promise.all([
    client
      .from('projects')
      .select('*')
      .eq('company_id', companyId)
      .eq('deleted', false)
      .or(`name.ilike.${like},client_name.ilike.${like}`)
      .limit(20),
    client
      .from('time_entries')
      .select(TIME_ENTRY_SELECT)
      .eq('company_id', companyId)
      .eq('deleted', false)
      .ilike('description', like)
      .order('entry_date', { ascending: false })
      .limit(20),
    client
      .from('invoices')
      .select(INVOICE_SELECT)
      .eq('company_id', companyId)
      .eq('deleted', false)
      .ilike('invoice_number', like)
      .limit(20),
  ]);

  if (projects.error) throw projects.error;
  if (entries.error) throw entries.error;
  if (invoices.error) throw invoices.error;

  return {
    projects: (projects.data ?? []) as Project[],
    entries: (entries.data ?? []) as unknown as TimeEntryWithProject[],
    invoices: (invoices.data ?? []) as unknown as InvoiceWithRelations[],
  };
}
