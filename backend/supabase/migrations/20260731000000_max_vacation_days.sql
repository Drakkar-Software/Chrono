-- ============================================================================
-- Max paid vacation days per year
--
-- Mirrors max_holidays_per_year: an optional cap on how many `time_off` rows
-- of kind 'vacation' a member may accumulate in a single calendar year
-- (null = unlimited). Enforced client-side when adding a vacation entry, the
-- same way the holiday policy is enforced when adding a company holiday.
-- ============================================================================

alter table public.companies
  add column max_vacation_days_per_year integer null
    check (max_vacation_days_per_year is null or max_vacation_days_per_year >= 0);

comment on column public.companies.max_vacation_days_per_year is
  'Optional cap on how many paid-vacation (time_off.kind = vacation) days a member may take in a single calendar year. Null = unlimited.';
