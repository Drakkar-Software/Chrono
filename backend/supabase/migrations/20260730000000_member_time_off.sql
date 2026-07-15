-- ============================================================================
-- Member time off
--
-- Self-service day / partial-day / hours-off tracking for a freelancer,
-- distinct from `company_holidays` (company-wide, manager-only, whole-date).
-- `duration_minutes` null = a full day off; a positive value = partial hours
-- off. One row per (user_id, off_date) — editing a day's time off means
-- deleting and re-adding, matching the small-config-list pattern of
-- `company_holidays` rather than the mutable `time_entries` model.
--
-- Time off is not project-scoped and never touches billing/invoicing — it
-- only feeds the client-side business-day math (packages/sdk/src/time-off)
-- that nets it out of `businessDaysInMonth`'s capacity figure.
-- ============================================================================

create type public.time_off_kind as enum ('vacation', 'sick', 'personal', 'holiday');

create table public.time_off (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  off_date         date not null,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  kind             public.time_off_kind not null default 'vacation',
  note             text,
  created_at       timestamptz not null default now(),
  unique (user_id, off_date)
);

comment on column public.time_off.duration_minutes is
  'Null = a full day off. A positive value = partial hours off on that date.';

create index time_off_user_date_idx on public.time_off (user_id, off_date);

alter table public.time_off enable row level security;

create policy "users or managers read time off"
  on public.time_off for select to authenticated
  using (user_id = (select auth.uid()) or public.is_company_manager(company_id));

create policy "users insert their own time off"
  on public.time_off for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_company_member(company_id));

create policy "users update their own time off"
  on public.time_off for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "users delete their own time off"
  on public.time_off for delete to authenticated
  using (user_id = (select auth.uid()));
