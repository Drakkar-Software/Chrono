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
};

export type { TimeEntryStatus };
