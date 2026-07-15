import type { Tables, TablesInsert, TablesUpdate } from '../schema';

export type CompanyHoliday = Tables<'company_holidays'>;
export type CompanyHolidayInsert = TablesInsert<'company_holidays'>;
export type CompanyHolidayUpdate = TablesUpdate<'company_holidays'>;
