-- ============================================================================
-- Feature batch: time-entry tags, sequential invoice numbers, manual payment
-- recording, an audit log, and pg_cron reminders.
--
-- Additive on top of the earlier migrations. New columns / tables / triggers
-- only; no existing row semantics change.
-- ============================================================================
set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- Time-entry tags — a free-form label set per entry, filterable and reportable.
-- ----------------------------------------------------------------------------
alter table public.time_entries
  add column tags text[] not null default '{}';

create index time_entries_tags_idx on public.time_entries using gin (tags);

-- ----------------------------------------------------------------------------
-- Sequential invoice numbers + issue date.
--
-- A per-company, per-year counter yields a monotonic human number (2026-0001)
-- stamped when a draft is submitted. Numbers are immutable once set.
-- ----------------------------------------------------------------------------
alter table public.invoices
  add column invoice_number text,
  add column issued_on date;

create unique index invoices_company_number_idx
  on public.invoices (company_id, invoice_number)
  where invoice_number is not null;

create table public.invoice_counters (
  company_id uuid not null references public.companies (id) on delete cascade,
  year       integer not null,
  last_seq   integer not null default 0,
  primary key (company_id, year)
);
alter table public.invoice_counters enable row level security;
-- Only the SECURITY DEFINER numbering trigger touches this; no client policies.

-- Atomically allocate the next number for a company+year.
create or replace function public.next_invoice_number(p_company uuid, p_year integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq integer;
begin
  insert into public.invoice_counters (company_id, year, last_seq)
  values (p_company, p_year, 1)
  on conflict (company_id, year)
    do update set last_seq = public.invoice_counters.last_seq + 1
  returning last_seq into v_seq;

  return p_year::text || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- Stamp number + issue date on the draft -> submitted transition, once.
create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer;
begin
  if new.status = 'submitted'
     and old.status is distinct from 'submitted'
     and new.invoice_number is null then
    v_year := extract(year from coalesce(new.period_month, current_date))::integer;
    new.invoice_number := public.next_invoice_number(new.company_id, v_year);
    new.issued_on := current_date;
  end if;
  return new;
end;
$$;

-- Runs after enforce_invoice_integrity (alphabetical order: e < z); it only sets
-- invoice_number/issued_on, which that trigger never touches.
create trigger zz_assign_invoice_number_trigger
  before update on public.invoices
  for each row execute function public.assign_invoice_number();

-- ----------------------------------------------------------------------------
-- Manual payments — actual disbursements recorded by a manager, separate from
-- the auto-FIFO funding settlement (which lives in invoices.amount_paid_cents).
-- ----------------------------------------------------------------------------
create table public.invoice_payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoices (id) on delete cascade,
  company_id   uuid not null references public.companies (id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  paid_on      date not null default current_date,
  method       text,   -- 'bank_transfer' | 'card' | 'cash' | 'other'
  note         text,
  recorded_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted      boolean not null default false
);

alter table public.invoice_payments enable row level security;

-- The invoice's freelancer and the company's managers can read payments.
create policy "freelancer and managers read payments"
  on public.invoice_payments for select to authenticated
  using (
    public.is_company_manager(company_id)
    or exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.freelancer_id = (select auth.uid())
    )
  );

create policy "managers record payments"
  on public.invoice_payments for insert to authenticated
  with check (
    public.is_company_manager(company_id)
    and recorded_by = (select auth.uid())
    and company_id = (select i.company_id from public.invoices i where i.id = invoice_id)
  );

create policy "managers update payments"
  on public.invoice_payments for update to authenticated
  using (public.is_company_manager(company_id))
  with check (public.is_company_manager(company_id));

create policy "managers delete payments"
  on public.invoice_payments for delete to authenticated
  using (public.is_company_manager(company_id));

create index invoice_payments_invoice_idx on public.invoice_payments (invoice_id);
create index invoice_payments_company_idx on public.invoice_payments (company_id);

create trigger set_invoice_payments_updated_at
  before update on public.invoice_payments
  for each row execute function public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Audit log — append-only record of money & role changes. Client-readable by
-- managers; written only by the SECURITY DEFINER triggers below (no write RLS).
-- ----------------------------------------------------------------------------
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,        -- 'role_changed' | 'invoice_settled' | 'payment_recorded'
  entity_type text not null,        -- 'company_member' | 'invoice' | 'invoice_payment'
  entity_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "managers read the audit log"
  on public.audit_log for select to authenticated
  using (public.is_company_manager(company_id));

create index audit_log_company_created_idx on public.audit_log (company_id, created_at desc);

-- Role changes on company_members.
create or replace function public.audit_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    insert into public.audit_log (company_id, actor_id, action, entity_type, entity_id, detail)
    values (
      new.company_id, (select auth.uid()), 'role_changed', 'company_member', new.id,
      jsonb_build_object('user_id', new.user_id, 'from', old.role, 'to', new.role)
    );
  end if;
  return new;
end;
$$;

create trigger audit_role_change_trigger
  after update of role on public.company_members
  for each row execute function public.audit_role_change();

-- Invoice settlement (status -> paid / partially_paid).
create or replace function public.audit_invoice_settled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status in ('paid', 'partially_paid') then
    insert into public.audit_log (company_id, actor_id, action, entity_type, entity_id, detail)
    values (
      new.company_id, (select auth.uid()), 'invoice_settled', 'invoice', new.id,
      jsonb_build_object(
        'freelancer_id', new.freelancer_id,
        'period', to_char(new.period_month, 'YYYY-MM'),
        'status', new.status,
        'paid_cents', new.amount_paid_cents,
        'carried_cents', new.credit_carried_forward_cents
      )
    );
  end if;
  return new;
end;
$$;

create trigger audit_invoice_settled_trigger
  after update of status on public.invoices
  for each row execute function public.audit_invoice_settled();

-- Manual payment recording.
create or replace function public.audit_payment_recorded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (company_id, actor_id, action, entity_type, entity_id, detail)
  values (
    new.company_id, (select auth.uid()), 'payment_recorded', 'invoice_payment', new.id,
    jsonb_build_object('invoice_id', new.invoice_id, 'amount_cents', new.amount_cents,
                       'paid_on', new.paid_on, 'method', new.method)
  );
  return new;
end;
$$;

create trigger audit_payment_recorded_trigger
  after insert on public.invoice_payments
  for each row execute function public.audit_payment_recorded();

-- ----------------------------------------------------------------------------
-- Reminders — scheduled nudges emitted as notifications (which then push via the
-- pg_net dispatch trigger). New 'reminder' notification type.
-- ----------------------------------------------------------------------------
alter type public.notification_type add value if not exists 'reminder';

-- Emit reminder notifications across all companies. Idempotent within a day: a
-- given (user, kind, day) reminder is inserted at most once.
create or replace function public.enqueue_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := current_date;
  v_week_ago date := current_date - 7;
begin
  -- (1) Active freelancers who logged no time in the last 7 days.
  insert into public.notifications (company_id, user_id, type, title, body, data)
  select distinct cm.company_id, cm.user_id, 'reminder'::public.notification_type,
         'Log your time', 'You have not logged any time in the last 7 days.',
         jsonb_build_object('kind', 'log_time', 'day', v_today)
  from public.company_members cm
  where cm.deleted = false
    and not exists (
      select 1 from public.time_entries te
      where te.user_id = cm.user_id and te.company_id = cm.company_id
        and te.deleted = false and te.entry_date >= v_week_ago
    )
    -- Only remind people who belong to at least one project (can actually log).
    and exists (
      select 1 from public.project_members pm
      join public.projects p on p.id = pm.project_id
      where pm.user_id = cm.user_id and p.company_id = cm.company_id and pm.deleted = false
    )
    and not exists (
      select 1 from public.notifications n
      where n.user_id = cm.user_id and n.type = 'reminder'
        and n.data ->> 'kind' = 'log_time' and (n.data ->> 'day')::date = v_today
    );

  -- (2) Managers with pending approvals waiting.
  insert into public.notifications (company_id, user_id, type, title, body, data)
  select distinct cm.company_id, cm.user_id, 'reminder'::public.notification_type,
         'Approvals waiting', 'Time entries are waiting for your approval.',
         jsonb_build_object('kind', 'approvals', 'day', v_today)
  from public.company_members cm
  where cm.deleted = false and cm.role in ('manager', 'admin')
    and exists (
      select 1 from public.time_entries te
      where te.company_id = cm.company_id and te.status = 'pending' and te.deleted = false
    )
    and not exists (
      select 1 from public.notifications n
      where n.user_id = cm.user_id and n.type = 'reminder'
        and n.data ->> 'kind' = 'approvals' and (n.data ->> 'day')::date = v_today
    );
end;
$$;

-- Schedule weekly (Mon 09:00) where pg_cron is available; tolerate its absence.
do $$
begin
  create extension if not exists pg_cron;
  if to_regproc('cron.schedule') is not null then
    perform cron.schedule('chrono-weekly-reminders', '0 9 * * 1', 'select public.enqueue_reminders()');
  end if;
exception when others then
  raise notice 'pg_cron unavailable — reminders can be scheduled manually or via an external cron calling enqueue_reminders()';
end $$;
