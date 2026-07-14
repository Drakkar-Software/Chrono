import type {
  RevenueSourceType,
  Tables,
  TablesInsert,
  TablesUpdate,
} from '../schema';

export type RevenueEntry = Tables<'revenue_entries'>;
export type RevenueEntryInsert = TablesInsert<'revenue_entries'>;
export type RevenueEntryUpdate = TablesUpdate<'revenue_entries'>;

export type RevenueEntryFilters = {
  type?: RevenueSourceType;
  from?: string;
  to?: string;
};
