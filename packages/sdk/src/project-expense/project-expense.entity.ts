import type { Tables, TablesInsert, TablesUpdate } from '../schema';

export type ProjectExpense = Tables<'project_expenses'>;
export type ProjectExpenseInsert = TablesInsert<'project_expenses'>;
export type ProjectExpenseUpdate = TablesUpdate<'project_expenses'>;

export type ExpenseFilters = {
  companyId: string;
  userId?: string;
  projectId?: string;
  status?: ProjectExpense['status'];
};
