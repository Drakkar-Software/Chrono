-- ============================================================================
-- Working days + holidays
--
-- working_weekdays: ISO weekday numbers (1=Mon .. 7=Sun) counted as a
-- "business day" when computing the max days a person can log in a period.
-- Company-level default, with an optional per-member override (null =
-- inherit the company default). All the actual business-day math is pure
-- client-side (packages/sdk/src/business-days) — these columns are just the
-- configuration inputs.
--
-- company_holidays: a company-wide list of non-working dates that further
-- reduce the business-day count. `recurring` holidays repeat on the same
-- month/day every year (e.g. a fixed public holiday) so one row covers every
-- year; non-recurring rows are one-off dates.
--
-- max_holidays_per_year: an optional cap on how many holiday rows a company
-- may declare in a single calendar year (null = unlimited) — the "holiday
-- policy" knob, enforced client-side when adding a holiday.
-- ============================================================================

alter table public.companies
  add column working_weekdays integer[] not null default '{1,2,3,4,5}',
  add column max_holidays_per_year integer null
    check (max_holidays_per_year is null or max_holidays_per_year >= 0);

comment on column public.companies.working_weekdays is
  'ISO weekday numbers (1=Mon..7=Sun) counted as business days for this company by default.';
comment on column public.companies.max_holidays_per_year is
  'Optional cap on how many company_holidays rows may fall in a single calendar year. Null = unlimited.';

alter table public.company_members
  add column working_weekdays integer[] null;

comment on column public.company_members.working_weekdays is
  'Per-member override of the company''s working_weekdays. Null = inherit the company default.';

create table public.company_holidays (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  holiday_date date not null,
  name         text,
  recurring    boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (company_id, holiday_date)
);

comment on column public.company_holidays.recurring is
  'When true, this holiday repeats on the same month/day every year (holiday_date''s year is a placeholder).';

alter table public.company_holidays enable row level security;

create policy "members read their company holidays"
  on public.company_holidays for select to authenticated
  using (public.is_company_member(company_id));

create policy "managers manage company holidays"
  on public.company_holidays for all to authenticated
  using (public.is_company_manager(company_id))
  with check (public.is_company_manager(company_id));
