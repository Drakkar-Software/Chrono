-- ============================================================================
-- Feature batch: notifications (in-app + push), VAT/legal invoicing details,
-- and named company invites.
--
-- Additive migration on top of 20260713000000_initial.sql. Everything here is
-- new tables / columns / triggers — no existing row semantics change, except
-- enforce_invoice_integrity is extended to snapshot a VAT rate onto invoices.
-- ============================================================================

-- Forward references (emit triggers reference helpers defined lower down).
set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type public.notification_type as enum (
  'time_submitted',   -- freelancer logged time -> managers
  'time_approved',    -- manager approved an entry -> owner
  'time_rejected',    -- manager rejected an entry -> owner
  'invoice_paid',     -- settlement paid an invoice in full -> freelancer
  'invoice_partially_paid', -- settlement paid part of an invoice -> freelancer
  'referral_earned'   -- a referral earning was recorded -> referrer
);

-- ----------------------------------------------------------------------------
-- VAT + legal identity columns (structured, so they type into schema.ts and
-- render on the invoice document). All nullable — legal details are optional
-- until a company/freelancer fills them in; a null VAT rate means "no VAT".
-- ----------------------------------------------------------------------------
alter table public.companies
  add column legal_name      text,
  add column address         text,
  add column vat_id          text,   -- VAT registration number (e.g. FR..)
  add column registration_id text,   -- company registry id (e.g. SIRET)
  add column vat_rate        numeric(5, 2) check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 100));

alter table public.profiles
  add column address     text,
  add column vat_id      text,
  add column business_id text;   -- freelancer's business/registry id

-- Per-project override of the company VAT rate (null = inherit the company).
alter table public.projects
  add column vat_rate numeric(5, 2) check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 100));

-- Snapshot of the VAT rate applied to this invoice, stamped at draft/submit by
-- enforce_invoice_integrity so a later rate change never rewrites history.
alter table public.invoices
  add column vat_rate numeric(5, 2);

-- ----------------------------------------------------------------------------
-- Start Notifications  (in-app activity feed)
-- ----------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,  -- recipient
  type        public.notification_type not null,
  title       text not null,
  body        text,
  data        jsonb not null default '{}'::jsonb,  -- { entryId, invoiceId, projectId, ... }
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false
);

alter table public.notifications enable row level security;

-- Recipients read / mark-read / dismiss their own notifications. Rows are only
-- ever created by the SECURITY DEFINER emit triggers below — no client insert.
create policy "recipients read their notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "recipients update their notifications"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "recipients delete their notifications"
  on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null and deleted = false;

create trigger set_notifications_updated_at
  before update on public.notifications
  for each row execute function public.update_updated_at_column();
-- End Notifications

-- ----------------------------------------------------------------------------
-- Start Device Tokens  (Expo push tokens for push notifications)
-- ----------------------------------------------------------------------------
create table public.device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  token       text not null unique,        -- ExpoPushToken[...]
  platform    text,                          -- 'ios' | 'android' | 'web'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.device_tokens enable row level security;

-- A user fully owns their device rows (register / refresh / revoke).
create policy "users read their device tokens"
  on public.device_tokens for select to authenticated
  using (user_id = (select auth.uid()));

create policy "users register their device tokens"
  on public.device_tokens for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "users update their device tokens"
  on public.device_tokens for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "users delete their device tokens"
  on public.device_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

create index device_tokens_user_idx on public.device_tokens (user_id);

create trigger set_device_tokens_updated_at
  before update on public.device_tokens
  for each row execute function public.update_updated_at_column();
-- End Device Tokens

-- ----------------------------------------------------------------------------
-- Start Company Invites  (named email invites replacing the raw join code)
-- ----------------------------------------------------------------------------
create table public.company_invites (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  email        text not null,
  role         public.app_role not null default 'freelancer',
  -- Unguessable share token (two v4 UUIDs, hex, ~244 bits).
  token        text not null unique
                 default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  invited_by   uuid references auth.users (id) on delete set null,
  expires_at   timestamptz not null default (now() + interval '14 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users (id) on delete set null,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.company_invites enable row level security;

-- Managers manage their company's invites. Invitees never read the table
-- directly — they redeem a token through accept_company_invite (below), which
-- runs SECURITY DEFINER, so no "read by token" policy is needed or wanted.
create policy "managers read company invites"
  on public.company_invites for select to authenticated
  using (public.is_company_manager(company_id));

create policy "managers create company invites"
  on public.company_invites for insert to authenticated
  with check (
    public.is_company_manager(company_id)
    and invited_by = (select auth.uid())
    -- Only admins may pre-assign a manager/admin role via an invite.
    and (role = 'freelancer' or public.is_company_admin(company_id))
  );

create policy "managers update company invites"
  on public.company_invites for update to authenticated
  using (public.is_company_manager(company_id))
  with check (public.is_company_manager(company_id));

create policy "managers delete company invites"
  on public.company_invites for delete to authenticated
  using (public.is_company_manager(company_id));

create index company_invites_company_idx on public.company_invites (company_id);
create index company_invites_token_idx on public.company_invites (token);

create trigger set_company_invites_updated_at
  before update on public.company_invites
  for each row execute function public.update_updated_at_column();

-- Redeem an invite token: join the company at the invited role. Runs as definer
-- so an invitee who is not yet a member can look the invite up by token only.
create or replace function public.accept_company_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.company_invites;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Must be signed in to accept an invite';
  end if;

  select * into v_invite
  from public.company_invites
  where token = p_token
  for update;

  if v_invite.id is null then
    raise exception 'Invite not found';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'This invite has been revoked';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'This invite has already been used';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invite has expired';
  end if;

  -- Join at the invited role (or keep an existing, possibly higher, membership).
  insert into public.company_members (company_id, user_id, role)
  values (v_invite.company_id, v_uid, v_invite.role)
  on conflict (company_id, user_id) do nothing;

  update public.company_invites
  set accepted_at = now(), accepted_by = v_uid, updated_at = now()
  where id = v_invite.id;

  return v_invite.company_id;
end;
$$;

grant execute on function public.accept_company_invite(text) to authenticated;
-- End Company Invites

-- ============================================================================
-- Notification emitters
-- ============================================================================

-- New pending time entry -> notify every manager of the company (except the
-- submitter, if they happen to be a manager logging their own time).
create or replace function public.notify_time_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project text;
  v_who text;
begin
  select name into v_project from public.projects where id = new.project_id;
  select coalesce(full_name, 'A teammate') into v_who from public.profiles where user_id = new.user_id;

  insert into public.notifications (company_id, user_id, type, title, body, data)
  select
    new.company_id,
    cm.user_id,
    'time_submitted',
    'Time logged for approval',
    coalesce(v_who, 'A teammate') || ' logged time on ' || coalesce(v_project, 'a project'),
    jsonb_build_object('entryId', new.id, 'projectId', new.project_id, 'userId', new.user_id)
  from public.company_members cm
  where cm.company_id = new.company_id
    and cm.role in ('manager', 'admin')
    and cm.deleted = false
    and cm.user_id <> new.user_id;

  return new;
end;
$$;

create trigger notify_time_submitted_trigger
  after insert on public.time_entries
  for each row execute function public.notify_time_submitted();

-- Approved / rejected -> notify the entry's owner (skip manager self-review).
create or replace function public.notify_time_reviewed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status not in ('approved', 'rejected') then
    return new;
  end if;
  if new.approved_by is not distinct from new.user_id then
    return new;  -- self-review, no notification
  end if;

  select name into v_project from public.projects where id = new.project_id;

  insert into public.notifications (company_id, user_id, type, title, body, data)
  values (
    new.company_id,
    new.user_id,
    (case when new.status = 'approved' then 'time_approved' else 'time_rejected' end)::public.notification_type,
    (case when new.status = 'approved' then 'Time approved' else 'Time rejected' end),
    (case
       when new.status = 'approved'
         then 'Your time on ' || coalesce(v_project, 'a project') || ' was approved'
       else 'Your time on ' || coalesce(v_project, 'a project') || ' was rejected'
            || coalesce(': ' || new.rejection_reason, '')
     end),
    jsonb_build_object('entryId', new.id, 'projectId', new.project_id)
  );

  return new;
end;
$$;

create trigger notify_time_reviewed_trigger
  after update of status on public.time_entries
  for each row execute function public.notify_time_reviewed();

-- Invoice settled to paid / partially_paid -> notify the freelancer. Fires from
-- inside settle_project_month (an ordinary AFTER trigger), once per transition.
create or replace function public.notify_invoice_settled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project text;
  v_period text := to_char(new.period_month, 'YYYY-MM');
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status not in ('paid', 'partially_paid') then
    return new;
  end if;

  select name into v_project from public.projects where id = new.project_id;

  insert into public.notifications (company_id, user_id, type, title, body, data)
  values (
    new.company_id,
    new.freelancer_id,
    (case when new.status = 'paid' then 'invoice_paid' else 'invoice_partially_paid' end)::public.notification_type,
    (case when new.status = 'paid' then 'Invoice paid' else 'Invoice partially paid' end),
    coalesce(v_project, 'A project') || ' · ' || v_period,
    jsonb_build_object('invoiceId', new.id, 'projectId', new.project_id,
                       'paidCents', new.amount_paid_cents, 'carriedCents', new.credit_carried_forward_cents)
  );

  return new;
end;
$$;

create trigger notify_invoice_settled_trigger
  after update of status on public.invoices
  for each row execute function public.notify_invoice_settled();

-- A newly recorded referral earning -> notify the referrer. Only fires on INSERT
-- (the first time a month's earning is recorded), not on re-settle updates.
create or replace function public.notify_referral_earned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project text;
  v_period text := to_char(new.period_month, 'YYYY-MM');
begin
  if new.amount_cents <= 0 then
    return new;
  end if;

  select name into v_project from public.projects where id = new.project_id;

  insert into public.notifications (company_id, user_id, type, title, body, data)
  values (
    new.company_id,
    new.referrer_id,
    'referral_earned',
    'Referral earning',
    coalesce(v_project, 'A project') || ' · ' || v_period,
    jsonb_build_object('projectId', new.project_id, 'amountCents', new.amount_cents, 'period', v_period)
  );

  return new;
end;
$$;

create trigger notify_referral_earned_trigger
  after insert on public.referral_earnings
  for each row execute function public.notify_referral_earned();

-- ============================================================================
-- Extend enforce_invoice_integrity to snapshot the VAT rate. Identical to the
-- initial version except it also stamps new.vat_rate from the project's rate
-- (falling back to the company default) for every non-settlement writer.
-- ============================================================================
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
  v_vat numeric(5, 2);
begin
  if public.project_company_id(new.project_id) is distinct from new.company_id then
    raise exception 'invoice company_id must match its project';
  end if;

  if current_setting('chrono.settling', true) = 'on' then
    return new;
  end if;

  if not public.is_company_manager(new.company_id) then
    if new.freelancer_id <> (select auth.uid()) then
      raise exception 'Cannot write an invoice for another user';
    end if;
    if not public.is_project_member(new.project_id) then
      raise exception 'Invalid project for this invoice';
    end if;
    if new.status not in ('draft', 'submitted') then
      raise exception 'Freelancers may only draft or submit invoices';
    end if;
  else
    if new.status not in ('draft', 'submitted', 'cancelled') then
      raise exception 'Settlement statuses are set only by settle_project_month';
    end if;
    if tg_op = 'UPDATE'
       and old.status in ('paid', 'partially_paid')
       and new.status in ('draft', 'submitted') then
      raise exception 'A settled invoice can only be cancelled, not reverted';
    end if;
  end if;

  select p.hours_per_day, coalesce(pm.tjm_cents, p.default_tjm_cents, 0), coalesce(p.vat_rate, c.vat_rate)
    into v_hpd, v_tjm, v_vat
  from public.projects p
  join public.companies c on c.id = p.company_id
  left join public.project_members pm
    on pm.project_id = p.id and pm.user_id = new.freelancer_id
  where p.id = new.project_id;

  select coalesce(sum(duration_minutes), 0) into v_minutes
  from public.time_entries
  where project_id = new.project_id
    and user_id = new.freelancer_id
    and status = 'approved' and billable = true and deleted = false
    and (invoice_id is null or invoice_id = new.id)
    and entry_date >= date_trunc('month', new.period_month)::date
    and entry_date < (date_trunc('month', new.period_month) + interval '1 month')::date;

  select coalesce(credit_carried_forward_cents, 0) into v_credit
  from public.invoices
  where project_id = new.project_id
    and freelancer_id = new.freelancer_id
    and settled_at is not null
    and deleted = false
    and id is distinct from new.id
  order by period_month desc
  limit 1;

  new.tjm_cents := v_tjm;
  new.hours_per_day := v_hpd;
  new.worked_minutes := v_minutes;
  new.earned_cents := round(v_minutes::numeric / (v_hpd * 60) * v_tjm);
  new.credit_brought_forward_cents := coalesce(v_credit, 0);
  new.amount_due_cents := new.earned_cents + new.credit_brought_forward_cents;
  new.vat_rate := v_vat;  -- snapshot; null = no VAT

  if tg_op = 'INSERT' then
    new.amount_paid_cents := 0;
    new.credit_carried_forward_cents := 0;
    new.funding_snapshot_cents := null;
    new.settled_at := null;
  else
    new.amount_paid_cents := old.amount_paid_cents;
    new.credit_carried_forward_cents := old.credit_carried_forward_cents;
    new.funding_snapshot_cents := old.funding_snapshot_cents;
    new.settled_at := old.settled_at;
  end if;

  if new.status = 'cancelled' then
    new.amount_paid_cents := 0;
    new.credit_carried_forward_cents := 0;
    new.settled_at := null;
    update public.time_entries set invoice_id = null, updated_at = now()
    where invoice_id = new.id;
  end if;

  return new;
end;
$$;
