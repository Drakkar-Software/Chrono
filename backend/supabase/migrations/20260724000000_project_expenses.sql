-- ============================================================================
-- Freelancer expense tracking (reimbursable project costs)
--
-- A freelancer submits a project expense (with an optional receipt) → a
-- manager approves/rejects it → an approved expense is reimbursable and can
-- be marked as paid. Lifecycle mirrors time_entries (owner submits pending,
-- manager moderates) rather than project_fixed_costs (manager-only), since
-- an expense is submitted BY the freelancer, not configured by a manager.
--
-- Money model: an approved expense is a real project COST (reduces margin,
-- see project-expense.lib.ts + revenue-entry.lib.ts's projectMargin), but is
-- paid OUTSIDE settle_project_month in v1 — it does not touch the FIFO pool
-- or availableFunding. Reimbursement is tracked with reimbursed_at/by and
-- surfaced in reports as "owed to freelancer", settled by a manager outside
-- the app for now (bank transfer, etc.), same as invoice_payments does for
-- invoices.
-- ============================================================================

create type public.expense_status as enum ('pending', 'approved', 'rejected');

-- ----------------------------------------------------------------------------
-- Start Project Expenses
-- ----------------------------------------------------------------------------
create table public.project_expenses (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  company_id        uuid not null references public.companies (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,  -- submitter
  description       text not null,
  amount_cents      bigint not null check (amount_cents > 0),
  spent_on          date not null default current_date,
  category          text,
  receipt_url       text,
  status            public.expense_status not null default 'pending',
  approved_by       uuid references auth.users (id) on delete set null,
  approved_at       timestamptz,
  rejection_reason  text,
  reimbursed_at     timestamptz,
  reimbursed_by     uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted           boolean not null default false
);

alter table public.project_expenses enable row level security;

create policy "owners and managers read expenses"
  on public.project_expenses for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_company_manager(company_id)
  );

-- Insert: own, pending, and assigned to the project.
create policy "assigned freelancers submit expenses"
  on public.project_expenses for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and public.is_project_member(project_id)
    and company_id = public.project_company_id(project_id)
  );

-- Owner edits (e.g. attaches a receipt) only while pending.
create policy "owners edit their pending expenses"
  on public.project_expenses for update to authenticated
  using (user_id = (select auth.uid()) and status = 'pending')
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and public.is_project_member(project_id)
    and company_id = public.project_company_id(project_id)
  );

-- Managers approve / reject / mark reimbursed.
create policy "managers moderate expenses"
  on public.project_expenses for update to authenticated
  using (public.is_company_manager(company_id))
  with check (public.is_company_manager(company_id));

create index project_expenses_project_idx on public.project_expenses (project_id);
create index project_expenses_company_status_idx on public.project_expenses (company_id, status);

create trigger set_project_expenses_updated_at
  before update on public.project_expenses
  for each row execute function public.update_updated_at_column();

-- Stamp approver metadata on status change (mirrors on_time_entry_status_change).
create or replace function public.on_expense_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('approved', 'rejected') then
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

create trigger stamp_expense_status
  before update of status on public.project_expenses
  for each row execute function public.on_expense_status_change();
-- End Project Expenses

-- ----------------------------------------------------------------------------
-- Notifications: extend the type enum + emitters (mirrors notify_time_submitted
-- / notify_time_reviewed in 20260714000000_notifications_billing_invites.sql).
-- Push dispatch is automatic — dispatch_notification_push_trigger already fires
-- on every insert into notifications regardless of type.
-- ----------------------------------------------------------------------------
alter type public.notification_type add value 'expense_submitted';
alter type public.notification_type add value 'expense_approved';
alter type public.notification_type add value 'expense_rejected';

-- New pending expense -> notify every manager of the company (except the
-- submitter, if they happen to be a manager submitting their own expense).
-- Function bodies are only compiled here, not executed — referencing the new
-- enum values above is safe even within this same migration transaction.
create or replace function public.notify_expense_submitted()
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
    'expense_submitted',
    'Expense submitted for approval',
    coalesce(v_who, 'A teammate') || ' submitted an expense on ' || coalesce(v_project, 'a project'),
    jsonb_build_object('expenseId', new.id, 'projectId', new.project_id, 'userId', new.user_id)
  from public.company_members cm
  where cm.company_id = new.company_id
    and cm.role in ('manager', 'admin')
    and cm.deleted = false
    and cm.user_id <> new.user_id;

  return new;
end;
$$;

create trigger notify_expense_submitted_trigger
  after insert on public.project_expenses
  for each row execute function public.notify_expense_submitted();

-- Approved / rejected -> notify the expense's owner (skip manager self-review).
create or replace function public.notify_expense_reviewed()
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
    (case when new.status = 'approved' then 'expense_approved' else 'expense_rejected' end)::public.notification_type,
    (case when new.status = 'approved' then 'Expense approved' else 'Expense rejected' end),
    (case
       when new.status = 'approved'
         then 'Your expense on ' || coalesce(v_project, 'a project') || ' was approved'
       else 'Your expense on ' || coalesce(v_project, 'a project') || ' was rejected'
            || coalesce(': ' || new.rejection_reason, '')
     end),
    jsonb_build_object('expenseId', new.id, 'projectId', new.project_id)
  );

  return new;
end;
$$;

create trigger notify_expense_reviewed_trigger
  after update of status on public.project_expenses
  for each row execute function public.notify_expense_reviewed();

-- ----------------------------------------------------------------------------
-- Receipts storage bucket — private (not public-read, unlike avatars/logos).
-- Path convention: receipts/{company_id}/{expense_id}.{ext}. Any company
-- member may read/write within their company's folder (mirrors the
-- company-logos manager-scoping precedent); expense_id segments are
-- non-guessable UUIDs so this stays effectively scoped to real attachments.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "company members read receipts"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_company_member(((storage.foldername(name))[1])::uuid));

create policy "company members upload receipts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_company_member(((storage.foldername(name))[1])::uuid));

create policy "company members update receipts"
  on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and public.is_company_member(((storage.foldername(name))[1])::uuid));

create policy "company members delete receipts"
  on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.is_company_member(((storage.foldername(name))[1])::uuid));
