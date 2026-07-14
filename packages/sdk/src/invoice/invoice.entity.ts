import type {
  InvoiceStatus,
  Tables,
  TablesInsert,
  TablesUpdate,
} from '../schema';

export type Invoice = Tables<'invoices'>;
export type InvoiceInsert = TablesInsert<'invoices'>;
export type InvoiceUpdate = TablesUpdate<'invoices'>;

export type InvoiceWithRelations = Invoice & {
  project: { name: string } | null;
  freelancer: { full_name: string | null } | null;
};

export type InvoiceFilters = {
  companyId: string;
  freelancerId?: string;
  projectId?: string;
  month?: string;
  status?: InvoiceStatus;
};
