-- ============================================================================
-- Chrono — initial schema
-- Multi-tenant freelance time-tracking, revenue recognition & invoicing.
--
-- Money is stored as integer cents (bigint). Currency is per-company.
-- Layout follows a section-banner convention: each domain block is
--   CREATE TABLE -> ENABLE RLS -> POLICIES -> INDEXES -> TRIGGERS.
-- ============================================================================

-- Allow the helper functions below to forward-reference tables created later
-- in this migration (they are `language sql`, whose bodies are otherwise
-- validated at creation time). This is what `pg_dump` emits for the same reason.
set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto" with schema extensions;      -- gen_random_uuid()
create extension if not exists "uuid-ossp" with schema extensions;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type public.app_role as enum ('freelancer', 'manager', 'admin');
create type public.project_status as enum ('active', 'archived');
create type public.time_entry_status as enum ('pending', 'approved', 'rejected');
create type public.revenue_source_type as enum ('time_based', 'recurring', 'self_billing');
create type public.invoice_status as enum ('draft', 'submitted', 'partially_paid', 'paid', 'cancelled');

-- ----------------------------------------------------------------------------
-- Internal helper functions
-- ----------------------------------------------------------------------------

-- Generic updated_at trigger.
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Multi-tenant membership / role helpers. SECURITY DEFINER so RLS policies can
-- consult company_members without recursing into its own RLS.
create or replace function public.is_company_member(cid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.company_members cm
    where cm.company_id = cid and cm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_company_manager(cid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.company_members cm
    where cm.company_id = cid
      and cm.user_id = (select auth.uid())
      and cm.role in ('manager', 'admin')
  );
$$;

create or replace function public.is_company_admin(cid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.company_members cm
    where cm.company_id = cid
      and cm.user_id = (select auth.uid())
      and cm.role = 'admin'
  );
$$;

-- Does the caller share at least one company with the given user? SECURITY
-- DEFINER so it can consult company_members without recursing through RLS.
create or replace function public.shares_company_with(target uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.company_members me
    join public.company_members them on them.company_id = me.company_id
    where me.user_id = (select auth.uid())
      and them.user_id = target
  );
$$;

-- ----------------------------------------------------------------------------
-- Start Profiles
-- ----------------------------------------------------------------------------
create table public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  content     jsonb not null default '{}'::jsonb,
  onboarded   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false
);

alter table public.profiles enable row level security;

-- Readable to self and to anyone who shares a company (member lists, invoice /
-- referral author names). NOT world-readable — profiles.content may hold PII.
create policy "profiles readable to self and company peers"
  on public.profiles for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.shares_company_with(user_id)
  );

create policy "users insert their own profile"
  on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "users update their own profile"
  on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- New auth users get a profile row automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
-- End Profiles

-- ----------------------------------------------------------------------------
-- Start Companies
-- ----------------------------------------------------------------------------
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique,
  content     jsonb not null default '{}'::jsonb,   -- { name, logo_url }
  currency    text not null default 'EUR',
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false
);

alter table public.companies enable row level security;

create policy "members read their companies"
  on public.companies for select to authenticated
  using (public.is_company_member(id));

create policy "authenticated users create companies"
  on public.companies for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "admins update their company"
  on public.companies for update to authenticated
  using (public.is_company_admin(id))
  with check (public.is_company_admin(id));

create policy "admins delete their company"
  on public.companies for delete to authenticated
  using (public.is_company_admin(id));

create index companies_created_by_idx on public.companies (created_by);

create trigger set_companies_updated_at
  before update on public.companies
  for each row execute function public.update_updated_at_column();
-- End Companies

-- ----------------------------------------------------------------------------
-- Start Company Members  (tenancy + role anchor)
-- ----------------------------------------------------------------------------
create table public.company_members (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies (id) on delete cascade,
  user_id                  uuid not null references auth.users (id) on delete cascade,
  role                     public.app_role not null default 'freelancer',
  default_hourly_rate_cents integer,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted                  boolean not null default false,
  unique (company_id, user_id)
);

alter table public.company_members enable row level security;

create policy "members read the roster of their companies"
  on public.company_members for select to authenticated
  using (public.is_company_member(company_id));

create policy "managers add members, only admins add admins"
  on public.company_members for insert to authenticated
  with check (
    public.is_company_manager(company_id)
    and (role <> 'admin' or public.is_company_admin(company_id))
  );

create policy "managers update members"
  on public.company_members for update to authenticated
  using (public.is_company_manager(company_id))
  with check (public.is_company_manager(company_id));

-- Self-service join: a user may add themselves to a company as a plain
-- freelancer (via a shared company id / join code). They cannot self-assign a
-- privileged role — that still requires a manager/admin.
create policy "users self-join as freelancer"
  on public.company_members for insert to authenticated
  with check (user_id = (select auth.uid()) and role = 'freelancer');

create policy "managers remove members"
  on public.company_members for delete to authenticated
  using (public.is_company_manager(company_id));

create index company_members_user_idx on public.company_members (user_id);
create index company_members_company_idx on public.company_members (company_id);

create trigger set_company_members_updated_at
  before update on public.company_members
  for each row execute function public.update_updated_at_column();

-- Creating a company makes the creator its admin.
create or replace function public.handle_new_company()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.company_members (company_id, user_id, role)
    values (new.id, new.created_by, 'admin')
    on conflict (company_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_company_created
  after insert on public.companies
  for each row execute function public.handle_new_company();

-- Guard the admin tier (RLS WITH CHECK can't compare OLD/NEW). A non-admin may
-- not: (a) raise their own role, or (b) grant / revoke / alter the admin role on
-- anyone. The sole exception is the very first member of a brand-new company —
-- the creator-bootstrap performed by handle_new_company().
create or replace function public.enforce_role_change_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- (b) admin-tier changes require an existing admin (except the bootstrap row).
  if (new.role = 'admin'
      or (tg_op = 'UPDATE' and old.role = 'admin' and new.role is distinct from old.role))
     and not public.is_company_admin(new.company_id)
     and exists (
       select 1 from public.company_members cm
       where cm.company_id = new.company_id and cm.id is distinct from new.id
     ) then
    raise exception 'Only an admin can grant or change the admin role';
  end if;

  -- (a) no self-escalation.
  if tg_op = 'UPDATE'
     and new.role is distinct from old.role
     and new.user_id = (select auth.uid())
     and not public.is_company_admin(new.company_id) then
    raise exception 'Only an admin can change your role';
  end if;

  return new;
end;
$$;

create trigger enforce_role_change_rules_trigger
  before insert or update on public.company_members
  for each row execute function public.enforce_role_change_rules();
-- End Company Members

-- ----------------------------------------------------------------------------
-- Start Projects
-- ----------------------------------------------------------------------------
create table public.projects (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  name              text not null,
  description       text,
  color             text,
  client_name       text,
  status            public.project_status not null default 'active',
  budget_cents      bigint,                 -- contracted cap (informational)
  default_tjm_cents integer,                -- fallback day rate for members
  hours_per_day     numeric not null default 7,
  billable_default  boolean not null default true,
  starts_on         date,
  ends_on           date,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted           boolean not null default false
);

alter table public.projects enable row level security;

-- NOTE: the "read projects" SELECT policy references public.project_members and is
-- created in the Project Members section below, once that table exists.

create policy "managers create projects"
  on public.projects for insert to authenticated
  with check (public.is_company_manager(company_id));

create policy "managers update projects"
  on public.projects for update to authenticated
  using (public.is_company_manager(company_id))
  with check (public.is_company_manager(company_id));

create policy "managers delete projects"
  on public.projects for delete to authenticated
  using (public.is_company_manager(company_id));

create index projects_company_idx on public.projects (company_id);
create index projects_status_idx on public.projects (status);

create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.update_updated_at_column();
-- End Projects

-- ----------------------------------------------------------------------------
-- Start Project Members  (freelancer <-> project assignment + rate)
-- ----------------------------------------------------------------------------
create table public.project_members (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  tjm_cents       integer,                 -- this freelancer's day rate (null => project default)
  role_on_project text not null default 'member',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted         boolean not null default false,
  unique (project_id, user_id)
);

alter table public.project_members enable row level security;

-- helper: the company owning a project (SECURITY DEFINER, bypasses projects RLS)
create or replace function public.project_company_id(pid uuid)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select company_id from public.projects where id = pid;
$$;

-- helper: is the caller a member of the given project? SECURITY DEFINER so it
-- bypasses project_members RLS — a plain EXISTS(... from project_members ...)
-- inside project_members' own SELECT policy would recurse infinitely.
create or replace function public.is_project_member(pid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = pid and pm.user_id = (select auth.uid())
  );
$$;

-- The projects SELECT policy lives here because it depends on is_project_member.
create policy "managers and assigned members read projects"
  on public.projects for select to authenticated
  using (
    public.is_company_manager(company_id)
    or public.is_project_member(id)
  );

create policy "members read assignments they can see"
  on public.project_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_company_manager(public.project_company_id(project_id))
    or public.is_project_member(project_id)
  );

create policy "managers assign members"
  on public.project_members for insert to authenticated
  with check (public.is_company_manager(public.project_company_id(project_id)));

create policy "managers update assignments"
  on public.project_members for update to authenticated
  using (public.is_company_manager(public.project_company_id(project_id)))
  with check (public.is_company_manager(public.project_company_id(project_id)));

create policy "managers remove assignments"
  on public.project_members for delete to authenticated
  using (public.is_company_manager(public.project_company_id(project_id)));

create index project_members_project_idx on public.project_members (project_id);
create index project_members_user_idx on public.project_members (user_id);

create trigger set_project_members_updated_at
  before update on public.project_members
  for each row execute function public.update_updated_at_column();
-- End Project Members

-- ----------------------------------------------------------------------------
-- Start Time Entries  (manual entries, no live timer)
-- ----------------------------------------------------------------------------
create table public.time_entries (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  company_id       uuid not null references public.companies (id) on delete cascade,
  entry_date       date not null default current_date,
  duration_minutes integer not null check (duration_minutes > 0),
  description      text,
  billable         boolean not null default true,
  status           public.time_entry_status not null default 'pending',
  approved_by      uuid references auth.users (id) on delete set null,
  approved_at      timestamptz,
  rejection_reason text,
  invoice_id       uuid,   -- FK added after invoices table exists
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted          boolean not null default false
);

alter table public.time_entries enable row level security;

create policy "owners and managers read time entries"
  on public.time_entries for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_company_manager(company_id)
  );

-- Insert: own, pending, and assigned to the project.
create policy "assigned freelancers log time"
  on public.time_entries for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and public.is_project_member(project_id)
    and company_id = public.project_company_id(project_id)
  );

-- Owner edits only while pending and not yet invoiced.
create policy "owners edit their pending uninvoiced entries"
  on public.time_entries for update to authenticated
  using (
    user_id = (select auth.uid()) and status = 'pending' and invoice_id is null
  )
  with check (
    user_id = (select auth.uid()) and status = 'pending' and invoice_id is null
  );

-- Managers approve / reject.
create policy "managers moderate time entries"
  on public.time_entries for update to authenticated
  using (public.is_company_manager(company_id))
  with check (public.is_company_manager(company_id));

create policy "owners delete pending uninvoiced, admins delete any"
  on public.time_entries for delete to authenticated
  using (
    (user_id = (select auth.uid()) and status = 'pending' and invoice_id is null)
    or public.is_company_admin(company_id)
  );

create index time_entries_user_date_idx on public.time_entries (user_id, entry_date);
create index time_entries_project_date_idx on public.time_entries (project_id, entry_date);
create index time_entries_company_status_idx on public.time_entries (company_id, status);
create index time_entries_invoice_idx on public.time_entries (invoice_id);

create trigger set_time_entries_updated_at
  before update on public.time_entries
  for each row execute function public.update_updated_at_column();

-- Stamp approver metadata on status change.
create or replace function public.on_time_entry_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      new.approved_by = (select auth.uid());
      new.approved_at = now();
    elsif new.status = 'rejected' then
      new.approved_by = (select auth.uid());
      new.approved_at = now();
    else
      new.approved_by = null;
      new.approved_at = null;
    end if;
  end if;
  return new;
end;
$$;

create trigger stamp_time_entry_status
  before update of status on public.time_entries
  for each row execute function public.on_time_entry_status_change();
-- End Time Entries

-- ----------------------------------------------------------------------------
-- Start Revenue Sources  (a project's money inflow definitions)
-- ----------------------------------------------------------------------------
create table public.revenue_sources (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  type        public.revenue_source_type not null,
  name        text not null,
  active      boolean not null default true,
  starts_on   date,
  ends_on     date,
  -- type config:
  --   time_based   : { client_tjm_cents }
  --   recurring    : { monthly_amount_cents }
  --   self_billing : { client_tjm_cents, markup_pct }
  content     jsonb not null default '{}'::jsonb,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false
);

alter table public.revenue_sources enable row level security;

create policy "members read revenue sources"
  on public.revenue_sources for select to authenticated
  using (public.is_company_member(company_id));

create policy "managers write revenue sources"
  on public.revenue_sources for all to authenticated
  using (public.is_company_manager(company_id))
  with check (
    public.is_company_manager(company_id)
    and company_id = public.project_company_id(project_id)
  );

create index revenue_sources_project_idx on public.revenue_sources (project_id);

create trigger set_revenue_sources_updated_at
  before update on public.revenue_sources
  for each row execute function public.update_updated_at_column();
-- End Revenue Sources

-- ----------------------------------------------------------------------------
-- Start Revenue Entries  (recognized-revenue ledger = the funding pool)
-- ----------------------------------------------------------------------------
create table public.revenue_entries (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  company_id        uuid not null references public.companies (id) on delete cascade,
  revenue_source_id uuid not null references public.revenue_sources (id) on delete cascade,
  type              public.revenue_source_type not null,
  period_month      date not null,          -- first day of the month
  amount_cents      bigint not null,
  auto_generated    boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted           boolean not null default false,
  unique (revenue_source_id, period_month)
);

alter table public.revenue_entries enable row level security;

create policy "members read revenue entries"
  on public.revenue_entries for select to authenticated
  using (public.is_company_member(company_id));

create policy "managers write revenue entries"
  on public.revenue_entries for all to authenticated
  using (public.is_company_manager(company_id))
  with check (
    public.is_company_manager(company_id)
    and company_id = public.project_company_id(project_id)
  );

create index revenue_entries_project_month_idx on public.revenue_entries (project_id, period_month);

create trigger set_revenue_entries_updated_at
  before update on public.revenue_entries
  for each row execute function public.update_updated_at_column();
-- End Revenue Entries

-- ----------------------------------------------------------------------------
-- Start Project Referrals  (who earns a referral cut on a project)
-- ----------------------------------------------------------------------------
create table public.project_referrals (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,   -- the referrer
  percent     numeric(5, 2) not null check (percent > 0 and percent <= 100),
  starts_on   date,
  ends_on     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  unique (project_id, user_id)
);

alter table public.project_referrals enable row level security;

create policy "members read referrals"
  on public.project_referrals for select to authenticated
  using (public.is_company_member(company_id));

create policy "managers write referrals"
  on public.project_referrals for all to authenticated
  using (public.is_company_manager(company_id))
  with check (
    public.is_company_manager(company_id)
    and company_id = public.project_company_id(project_id)
  );

create index project_referrals_project_idx on public.project_referrals (project_id);
create index project_referrals_user_idx on public.project_referrals (user_id);

create trigger set_project_referrals_updated_at
  before update on public.project_referrals
  for each row execute function public.update_updated_at_column();

-- Active referral percentages on a project may not sum above 100.
create or replace function public.enforce_referral_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  total numeric;
begin
  select coalesce(sum(percent), 0) into total
  from public.project_referrals
  where project_id = new.project_id
    and deleted = false
    and id is distinct from new.id;
  if total + new.percent > 100 then
    raise exception 'Referral percentages for a project cannot exceed 100%% (would be %)', total + new.percent;
  end if;
  return new;
end;
$$;

create trigger enforce_referral_total_trigger
  before insert or update on public.project_referrals
  for each row execute function public.enforce_referral_total();
-- End Project Referrals

-- ----------------------------------------------------------------------------
-- Start Referral Earnings  (auto-paid first-claim ledger)
-- ----------------------------------------------------------------------------
create table public.referral_earnings (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  company_id        uuid not null references public.companies (id) on delete cascade,
  referrer_id       uuid not null references auth.users (id) on delete cascade,
  period_month      date not null,
  percent           numeric(5, 2) not null,
  revenue_base_cents bigint not null,
  amount_cents      bigint not null,
  settled_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted           boolean not null default false,
  unique (project_id, referrer_id, period_month)
);

alter table public.referral_earnings enable row level security;

create policy "referrer and managers read referral earnings"
  on public.referral_earnings for select to authenticated
  using (
    referrer_id = (select auth.uid())
    or public.is_company_manager(company_id)
  );

-- referral_earnings is a system-generated ledger written by settle_project_month
-- (SECURITY DEFINER, bypasses RLS as owner). Direct writes are admin-only so a
-- manager cannot fabricate a payout to themselves.
create policy "admins write referral earnings"
  on public.referral_earnings for all to authenticated
  using (public.is_company_admin(company_id))
  with check (
    public.is_company_admin(company_id)
    and company_id = public.project_company_id(project_id)
  );

create index referral_earnings_project_month_idx on public.referral_earnings (project_id, period_month);
create index referral_earnings_referrer_month_idx on public.referral_earnings (referrer_id, period_month);

create trigger set_referral_earnings_updated_at
  before update on public.referral_earnings
  for each row execute function public.update_updated_at_column();
-- End Referral Earnings

-- ----------------------------------------------------------------------------
-- Start Invoices  (one per freelancer x project x month)
-- ----------------------------------------------------------------------------
create table public.invoices (
  id                          uuid primary key default gen_random_uuid(),
  company_id                  uuid not null references public.companies (id) on delete cascade,
  project_id                  uuid not null references public.projects (id) on delete cascade,
  freelancer_id               uuid not null references auth.users (id) on delete cascade,
  period_month                date not null,
  worked_minutes              integer not null default 0,
  tjm_cents                   integer not null default 0,        -- snapshot
  hours_per_day               numeric not null default 7,        -- snapshot
  earned_cents                bigint not null default 0,
  credit_brought_forward_cents bigint not null default 0,
  amount_due_cents            bigint not null default 0,
  amount_paid_cents           bigint not null default 0,
  credit_carried_forward_cents bigint not null default 0,
  funding_snapshot_cents      bigint,
  status                      public.invoice_status not null default 'draft',
  submitted_at                timestamptz,
  submission_seq              bigserial,
  settled_at                  timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted                     boolean not null default false,
  unique (project_id, freelancer_id, period_month)
);

alter table public.invoices enable row level security;

create policy "freelancer and managers read invoices"
  on public.invoices for select to authenticated
  using (
    freelancer_id = (select auth.uid())
    or public.is_company_manager(company_id)
  );

-- Freelancer builds & submits their own draft, only on a project they belong to
-- and whose company matches. Money columns are (re)computed server-side by the
-- enforce_invoice_integrity trigger below — client-supplied amounts are ignored.
create policy "freelancers create their draft invoices"
  on public.invoices for insert to authenticated
  with check (
    freelancer_id = (select auth.uid())
    and status = 'draft'
    and company_id = public.project_company_id(project_id)
    and public.is_project_member(project_id)
  );

create policy "freelancers edit their draft invoices"
  on public.invoices for update to authenticated
  using (freelancer_id = (select auth.uid()) and status in ('draft', 'submitted'))
  with check (freelancer_id = (select auth.uid()) and status in ('draft', 'submitted'));

-- Managers settle (pay) invoices.
create policy "managers update invoices"
  on public.invoices for update to authenticated
  using (public.is_company_manager(company_id))
  with check (public.is_company_manager(company_id));

create policy "owner or admin delete draft invoices"
  on public.invoices for delete to authenticated
  using (
    (freelancer_id = (select auth.uid()) and status = 'draft')
    or public.is_company_admin(company_id)
  );

create index invoices_company_status_idx on public.invoices (company_id, status);
create index invoices_project_month_idx on public.invoices (project_id, period_month);
create index invoices_freelancer_idx on public.invoices (freelancer_id);

create trigger set_invoices_updated_at
  before update on public.invoices
  for each row execute function public.update_updated_at_column();

-- Invoice money integrity: freelancers must never be trusted to set their own
-- payable amounts. For any non-manager writer, recompute worked_minutes /
-- earned_cents / tjm / hours_per_day / credit_brought_forward from the actual
-- approved billable time entries and stored rates, and force the settlement
-- outputs to their zero/null defaults. Managers (including the SECURITY DEFINER
-- settle_project_month RPC, which runs with the manager's auth.uid()) pass through
-- so settlement can write the paid/carried columns.
create or replace function public.enforce_invoice_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hpd numeric;
  v_tjm integer;
  v_minutes integer;
  v_credit bigint;
begin
  if public.is_company_manager(new.company_id) then
    return new;
  end if;

  if new.freelancer_id <> (select auth.uid()) then
    raise exception 'Cannot write an invoice for another user';
  end if;
  if new.status not in ('draft', 'submitted') then
    raise exception 'Freelancers may only draft or submit invoices';
  end if;
  if public.project_company_id(new.project_id) is distinct from new.company_id
     or not public.is_project_member(new.project_id) then
    raise exception 'Invalid project for this invoice';
  end if;

  select p.hours_per_day, coalesce(pm.tjm_cents, p.default_tjm_cents, 0)
    into v_hpd, v_tjm
  from public.projects p
  left join public.project_members pm
    on pm.project_id = p.id and pm.user_id = new.freelancer_id
  where p.id = new.project_id;

  select coalesce(sum(duration_minutes), 0) into v_minutes
  from public.time_entries
  where project_id = new.project_id
    and user_id = new.freelancer_id
    and status = 'approved' and billable = true and deleted = false
    and date_trunc('month', entry_date)::date = date_trunc('month', new.period_month)::date;

  select coalesce(credit_carried_forward_cents, 0) into v_credit
  from public.invoices
  where project_id = new.project_id
    and freelancer_id = new.freelancer_id
    and settled_at is not null
    and id is distinct from new.id
  order by period_month desc
  limit 1;

  new.tjm_cents := v_tjm;
  new.hours_per_day := v_hpd;
  new.worked_minutes := v_minutes;
  new.earned_cents := round(v_minutes::numeric / (v_hpd * 60) * v_tjm);
  new.credit_brought_forward_cents := coalesce(v_credit, 0);
  new.amount_due_cents := new.earned_cents + new.credit_brought_forward_cents;
  -- Freelancers never write settlement outputs.
  new.amount_paid_cents := 0;
  new.credit_carried_forward_cents := 0;
  new.funding_snapshot_cents := null;
  new.settled_at := null;
  return new;
end;
$$;

create trigger enforce_invoice_integrity_trigger
  before insert or update on public.invoices
  for each row execute function public.enforce_invoice_integrity();

-- Now that invoices exists, wire the time_entries FK.
alter table public.time_entries
  add constraint time_entries_invoice_id_fkey
  foreign key (invoice_id) references public.invoices (id) on delete set null;
-- End Invoices

-- ============================================================================
-- Revenue recognition + settlement RPCs
-- ============================================================================

-- Recognize a project's revenue for a given month from its active sources.
-- Upserts one revenue_entries row per source. Manager-guarded.
create or replace function public.recognize_project_revenue(
  p_project_id uuid,
  p_period date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_hours_per_day numeric;
  v_period date := date_trunc('month', p_period)::date;
  v_src record;
  v_billable_minutes integer;
  v_billable_days numeric;
  v_amount bigint;
  v_client_tjm integer;
  v_markup numeric;
begin
  select company_id, hours_per_day into v_company_id, v_hours_per_day
  from public.projects where id = p_project_id;

  if v_company_id is null then
    raise exception 'Project not found';
  end if;

  if not public.is_company_manager(v_company_id) then
    raise exception 'Only a manager can recognize revenue';
  end if;

  for v_src in
    select * from public.revenue_sources
    where project_id = p_project_id
      and company_id = v_company_id
      and active = true
      and deleted = false
      and (starts_on is null or starts_on <= (v_period + interval '1 month - 1 day')::date)
      and (ends_on is null or ends_on >= v_period)
  loop
    if v_src.type = 'recurring' then
      v_amount := coalesce((v_src.content ->> 'monthly_amount_cents')::bigint, 0);
    else
      -- time_based / self_billing: bill approved billable time at the client day rate.
      select coalesce(sum(duration_minutes), 0) into v_billable_minutes
      from public.time_entries
      where project_id = p_project_id
        and company_id = v_company_id
        and billable = true
        and status = 'approved'
        and deleted = false
        and date_trunc('month', entry_date)::date = v_period;

      v_billable_days := v_billable_minutes::numeric / (v_hours_per_day * 60);
      v_client_tjm := coalesce((v_src.content ->> 'client_tjm_cents')::integer, 0);
      v_amount := round(v_billable_days * v_client_tjm);

      if v_src.type = 'self_billing' then
        v_markup := coalesce((v_src.content ->> 'markup_pct')::numeric, 0);
        v_amount := round(v_amount * (1 + v_markup / 100));
      end if;
    end if;

    insert into public.revenue_entries
      (project_id, company_id, revenue_source_id, type, period_month, amount_cents, auto_generated)
    values
      (p_project_id, v_company_id, v_src.id, v_src.type, v_period, v_amount, true)
    on conflict (revenue_source_id, period_month)
      do update set amount_cents = excluded.amount_cents, updated_at = now();
  end loop;
end;
$$;

-- Settle a project's month: recognize revenue, pay referrals off the top,
-- then settle submitted invoices FIFO against the remaining funding pool.
create or replace function public.settle_project_month(
  p_project_id uuid,
  p_period date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_period date := date_trunc('month', p_period)::date;
  v_month_revenue bigint;
  v_ref record;
  v_ref_amount bigint;
  v_cumulative_revenue bigint;
  v_cumulative_referral bigint;
  v_prior_paid bigint;
  v_available bigint;
  v_inv record;
  v_due bigint;
  v_paid bigint;
  v_carried bigint;
  v_new_status public.invoice_status;
begin
  select company_id into v_company_id from public.projects where id = p_project_id;
  if v_company_id is null then
    raise exception 'Project not found';
  end if;
  if not public.is_company_manager(v_company_id) then
    raise exception 'Only a manager can settle a project month';
  end if;

  -- (1) recognize this month's revenue
  perform public.recognize_project_revenue(p_project_id, v_period);

  -- (2) referrals: first claim, always fully funded (a fraction of this month's revenue)
  select coalesce(sum(amount_cents), 0) into v_month_revenue
  from public.revenue_entries
  where project_id = p_project_id and company_id = v_company_id
    and period_month = v_period and deleted = false;

  for v_ref in
    select * from public.project_referrals
    where project_id = p_project_id
      and company_id = v_company_id
      and deleted = false
      and (starts_on is null or starts_on <= (v_period + interval '1 month - 1 day')::date)
      and (ends_on is null or ends_on >= v_period)
  loop
    v_ref_amount := round(v_month_revenue * v_ref.percent / 100);
    insert into public.referral_earnings
      (project_id, company_id, referrer_id, period_month, percent, revenue_base_cents, amount_cents, settled_at)
    values
      (p_project_id, v_company_id, v_ref.user_id, v_period, v_ref.percent, v_month_revenue, v_ref_amount, now())
    on conflict (project_id, referrer_id, period_month)
      do update set percent = excluded.percent,
                    revenue_base_cents = excluded.revenue_base_cents,
                    amount_cents = excluded.amount_cents,
                    settled_at = now(),
                    updated_at = now();
  end loop;

  -- (3) available funding = cumulative revenue - cumulative referral - payments
  -- already made for ANY other month. Using `period_month <> v_period` (not
  -- `< v_period`) makes settlement order-independent: settling months out of
  -- order can no longer double-spend the same recognized revenue.
  select coalesce(sum(amount_cents), 0) into v_cumulative_revenue
  from public.revenue_entries
  where project_id = p_project_id and company_id = v_company_id
    and period_month <= v_period and deleted = false;

  select coalesce(sum(amount_cents), 0) into v_cumulative_referral
  from public.referral_earnings
  where project_id = p_project_id and company_id = v_company_id
    and period_month <= v_period and deleted = false;

  select coalesce(sum(amount_paid_cents), 0) into v_prior_paid
  from public.invoices
  where project_id = p_project_id and company_id = v_company_id
    and period_month <> v_period and deleted = false;

  v_available := v_cumulative_revenue - v_cumulative_referral - v_prior_paid;
  if v_available < 0 then
    v_available := 0;
  end if;

  -- settle this month's submitted invoices FIFO
  for v_inv in
    select * from public.invoices
    where project_id = p_project_id
      and company_id = v_company_id
      and period_month = v_period
      and status = 'submitted'
      and deleted = false
    order by submission_seq asc
  loop
    v_due := v_inv.earned_cents + v_inv.credit_brought_forward_cents;
    v_paid := least(v_available, v_due);
    if v_paid < 0 then
      v_paid := 0;
    end if;
    v_available := v_available - v_paid;
    v_carried := v_due - v_paid;

    if v_paid >= v_due then
      v_new_status := 'paid';
    elsif v_paid > 0 then
      v_new_status := 'partially_paid';
    else
      v_new_status := 'submitted';
    end if;

    update public.invoices
    set amount_due_cents = v_due,
        amount_paid_cents = v_paid,
        credit_carried_forward_cents = v_carried,
        funding_snapshot_cents = v_cumulative_revenue - v_cumulative_referral,
        status = v_new_status,
        settled_at = now(),
        updated_at = now()
    where id = v_inv.id;

    -- tag this month's approved billable entries for this freelancer as invoiced
    update public.time_entries
    set invoice_id = v_inv.id, updated_at = now()
    where project_id = p_project_id
      and user_id = v_inv.freelancer_id
      and status = 'approved'
      and billable = true
      and deleted = false
      and invoice_id is null
      and date_trunc('month', entry_date)::date = v_period;
  end loop;
end;
$$;

grant execute on function public.recognize_project_revenue(uuid, date) to authenticated;
grant execute on function public.settle_project_month(uuid, date) to authenticated;
