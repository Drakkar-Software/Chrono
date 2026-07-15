import type {
  TimeEntryStatus,
  Tables,
  TablesInsert,
  TablesUpdate,
} from '../schema';

export type TimeEntry = Tables<'time_entries'>;
export type TimeEntryInsert = TablesInsert<'time_entries'>;
export type TimeEntryUpdate = TablesUpdate<'time_entries'>;

export type TimeEntryWithProject = TimeEntry & {
  project: {
    name: string;
    color: string | null;
    hours_per_day: number;
    default_tjm_cents: number | null;
  } | null;
};

export type TimeEntryFilters = {
  companyId: string;
  userId?: string;
  projectId?: string;
  from?: string;
  to?: string;
  status?: TimeEntryStatus;
  billable?: boolean;
  /** When true, only entries not yet attached to an invoice (`invoice_id IS NULL`). */
  uninvoiced?: boolean;
};
