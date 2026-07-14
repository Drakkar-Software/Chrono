import type { ProjectStatus, Tables, TablesInsert, TablesUpdate } from '../schema';

export type Project = Tables<'projects'>;
export type ProjectInsert = TablesInsert<'projects'>;
export type ProjectUpdate = TablesUpdate<'projects'>;

export type ProjectFilters = {
  status?: ProjectStatus;
  search?: string;
};
