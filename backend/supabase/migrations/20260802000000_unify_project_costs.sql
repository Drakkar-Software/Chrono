-- ============================================================================
-- Unify project costs: one table, one `kind` sub-type
--
-- Costs used to live in two unrelated tables — `project_fixed_costs` (a
-- manager-configured overhead with a `recurring`/`one_off` cadence, subtracted
-- from the funding pool) and `project_expenses` (a freelancer-submitted,
-- manager-approved reimbursable, deliberately OUTSIDE the pool). "One-off cost"
-- was therefore modelled twice, and the project hub carried two cost rows.
--
-- This merges both into `public.project_costs`, discriminated by `kind`
-- (recurring | one_off | reimbursable) — the same shape `revenue_sources`
-- already uses for its `type` enum: shared columns, kind-specific nullable
-- columns, one CHECK per kind.
--
-- What is deliberately PRESERVED, not flattened:
--   * Money model. Only 'recurring'/'one_off' feed the FIFO pool (see
--     project_cost_cumulative below). 'reimbursable' still reduces margin only
--     and is paid outside settlement — the asymmetry documented in
--     20260724000000_project_expenses.sql.
--   * Visibility. Overhead/margin stays manager-only; a freelancer sees only
--     their own reimbursables. Encoded per-kind in the RLS policies.
--   * Amount bounds. Fixed costs allowed 0 (`>= 0`), expenses required `> 0`.
--     Rather than pick one and risk failing the data copy on an existing
--     zero-amount fixed cost, both bounds are kept, per kind.
--   * Row ids. Receipts live at `receipts/{company_id}/{expense_id}.{ext}`, so
--     ids are carried over verbatim — a fresh id would orphan every receipt.
-- ============================================================================

create type public.project_cost_kind as enum ('recurring', 'one_off', 'reimbursable');

-- ----------------------------------------------------------------------------
-- Start Project Costs
-- ----------------------------------------------------------------------------
create table public.project_costs (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  company_id   uuid not null references public.companies (id) on delete cascade,
  kind         public.project_cost_kind not null,
  -- `name` (fixed costs) and `description` (expenses) unified.
  label        text not null,
  amount_cents bigint not null,
  active       boolean not null default true,

  -- When this cost was actually paid. Null = not yet paid. Only PAID pool costs
  -- are deducted from the funding pool — the mirror of revenue_entries.paid_at,
  -- which gates the revenue side (see 20260727000000). Reimbursables do NOT use
  -- this column: they already track payment via reimbursed_at/reimbursed_by.
  paid_at      timestamptz,
  -- kind = 'recurring' only: deduct straight from project revenue every elapsed
  -- month without anyone ticking a box — each month in the window counts as
  -- paid automatically. Computed on the fly by project_cost_cumulative; no
  -- per-month rows are materialized (a recurring cost is a formula, not a
  -- ledger). A recurring cost WITHOUT this flag is deducted only once paid_at
  -- is set, and then for every elapsed month (one paid_at cannot express
  -- "month 3 paid, month 4 not" — use auto_deduct or a one_off per month).
  auto_deduct  boolean not null default false,

  -- kind = 'one_off'   : hits the pool in `period_month` only.
  period_month date,
  -- kind = 'recurring' : hits the pool every month in [starts_on, ends_on]
  --                      (ongoing when ends_on is null). starts_on is required
  --                      so the cumulative sum stays bounded.
  starts_on    date,
  ends_on      date,

  -- kind = 'reimbursable' only, from here down.
  user_id          uuid references auth.users (id) on delete cascade,  -- submitter
  spent_on         date,
  category         text,
  receipt_url      text,
  status           public.expense_status,
  approved_by      uuid references auth.users (id) on delete set null,
  approved_at      timestamptz,
  rejection_reason text,
  reimbursed_at    timestamptz,
  reimbursed_by    uuid references auth.users (id) on delete set null,

  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted      boolean not null default false,

  -- Each kind carries exactly the fields it needs (mirrors the old
  -- project_fixed_costs_cadence_fields constraint, extended to 3 kinds).
  constraint project_costs_kind_fields check (
    (kind = 'one_off' and period_month is not null)
    or (kind = 'recurring' and starts_on is not null)
    or (kind = 'reimbursable' and user_id is not null and spent_on is not null and status is not null)
  ),
  -- Pool kinds allowed a zero amount; a reimbursable never did.
  constraint project_costs_amount_bounds check (
    amount_cents >= 0 and (kind <> 'reimbursable' or amount_cents > 0)
  ),
  -- The lifecycle columns are meaningless on a manager-configured pool cost.
  constraint project_costs_lifecycle_scope check (
    kind = 'reimbursable'
    or (user_id is null and status is null and approved_by is null
        and approved_at is null and rejection_reason is null
        and reimbursed_at is null and reimbursed_by is null
        and receipt_url is null)
  ),
  -- Auto-deduct is a recurring-only idea: a one_off already lands in exactly
  -- one month, and a reimbursable is paid outside the pool entirely.
  constraint project_costs_auto_deduct_scope check (
    auto_deduct = false or kind = 'recurring'
  ),
  -- A reimbursable tracks payment via reimbursed_at, not paid_at — one payment
  -- concept per kind, so reports can't disagree with each other.
  constraint project_costs_paid_scope check (
    kind <> 'reimbursable' or paid_at is null
  )
);

alter table public.project_costs enable row level security;

-- Read: overhead/margin (recurring, one_off) is manager-only — the invariant
-- the old "managers read fixed costs" policy existed to hold. A freelancer may
-- additionally read their OWN reimbursables (old "owners and managers read
-- expenses").
create policy "read project costs"
  on public.project_costs for select to authenticated
  using (
    public.is_company_manager(company_id)
    or (kind = 'reimbursable' and user_id = (select auth.uid()))
  );

-- Managers configure any kind.
create policy "managers write project costs"
  on public.project_costs for all to authenticated
  using (public.is_company_manager(company_id))
  with check (
    public.is_company_manager(company_id)
    and company_id = public.project_company_id(project_id)
  );

-- Assigned members submit their own reimbursable, pending.
create policy "assigned members submit reimbursable costs"
  on public.project_costs for insert to authenticated
  with check (
    kind = 'reimbursable'
    and user_id = (select auth.uid())
    and status = 'pending'
    and public.is_project_member(project_id)
    and company_id = public.project_company_id(project_id)
  );

-- Owners edit their own reimbursable (e.g. attach a receipt) only while pending.
create policy "owners edit their pending reimbursable costs"
  on public.project_costs for update to authenticated
  using (kind = 'reimbursable' and user_id = (select auth.uid()) and status = 'pending')
  with check (
    kind = 'reimbursable'
    and user_id = (select auth.uid())
    and status = 'pending'
    and public.is_project_member(project_id)
    and company_id = public.project_company_id(project_id)
  );

create index project_costs_project_idx on public.project_costs (project_id);
create index project_costs_company_status_idx on public.project_costs (company_id, status);

create trigger set_project_costs_updated_at
  before update on public.project_costs
  for each row execute function public.update_updated_at_column();
-- End Project Costs

-- ----------------------------------------------------------------------------
-- Lifecycle triggers — reimbursable only (ported from project_expenses).
-- ----------------------------------------------------------------------------
create or replace function public.on_project_cost_status_change()
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

create trigger stamp_project_cost_status
  before update of status on public.project_costs
  for each row when (new.kind = 'reimbursable')
  execute function public.on_project_cost_status_change();

-- New pending reimbursable -> notify every manager except the submitter.
-- The expense_* notification enum values already exist (added in
-- 20260724000000_project_expenses.sql) — re-adding them here would fail.
create or replace function public.notify_project_cost_submitted()
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
    jsonb_build_object('costId', new.id, 'projectId', new.project_id, 'userId', new.user_id)
  from public.company_members cm
  where cm.company_id = new.company_id
    and cm.role in ('manager', 'admin')
    and cm.deleted = false
    and cm.user_id <> new.user_id;

  return new;
end;
$$;

create trigger notify_project_cost_submitted_trigger
  after insert on public.project_costs
  for each row when (new.kind = 'reimbursable')
  execute function public.notify_project_cost_submitted();

-- Approved / rejected -> notify the owner (skip manager self-review).
create or replace function public.notify_project_cost_reviewed()
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
    jsonb_build_object('costId', new.id, 'projectId', new.project_id)
  );

  return new;
end;
$$;

create trigger notify_project_cost_reviewed_trigger
  after update of status on public.project_costs
  for each row when (new.kind = 'reimbursable')
  execute function public.notify_project_cost_reviewed();

-- ----------------------------------------------------------------------------
-- Data migration — ids preserved (receipt paths embed them).
-- ----------------------------------------------------------------------------
-- Backfill of the new paid gate is NOT cosmetic. Before this migration every
-- active fixed cost was deducted from the pool unconditionally; the new
-- project_cost_cumulative deducts only PAID costs. Migrating these rows as
-- unpaid would silently drop them out of the pool, inflating available funding
-- and over-paying invoices on the next settle. So existing rows are backfilled
-- to reproduce their current behaviour exactly:
--   * recurring -> auto_deduct = true (they were already deducting every month)
--   * one_off   -> paid_at = created_at (they were already deducted once due)
-- `active` still gates both, exactly as before.
insert into public.project_costs (
  id, project_id, company_id, kind, label, amount_cents, active,
  paid_at, auto_deduct,
  period_month, starts_on, ends_on, created_by, created_at, updated_at, deleted
)
select
  fc.id, fc.project_id, fc.company_id, fc.cadence::text::public.project_cost_kind,
  fc.name, fc.amount_cents, fc.active,
  case when fc.cadence = 'one_off' then fc.created_at end,
  fc.cadence = 'recurring',
  fc.period_month, fc.starts_on, fc.ends_on, fc.created_by,
  fc.created_at, fc.updated_at, fc.deleted
from public.project_fixed_costs fc;

insert into public.project_costs (
  id, project_id, company_id, kind, label, amount_cents, active,
  user_id, spent_on, category, receipt_url, status,
  approved_by, approved_at, rejection_reason, reimbursed_at, reimbursed_by,
  created_by, created_at, updated_at, deleted
)
select
  e.id, e.project_id, e.company_id, 'reimbursable', e.description, e.amount_cents, true,
  e.user_id, e.spent_on, e.category, e.receipt_url, e.status,
  e.approved_by, e.approved_at, e.rejection_reason, e.reimbursed_at, e.reimbursed_by,
  e.user_id, e.created_at, e.updated_at, e.deleted
from public.project_expenses e;

-- ----------------------------------------------------------------------------
-- Cumulative POOL cost — the successor to project_fixed_cost_cumulative.
--
-- Two filters, both load-bearing:
--   * kind in ('recurring','one_off') — a reimbursable must never reach the
--     FIFO pool (it is paid outside settlement).
--   * PAID only — a cost is deducted from the pool once it has actually been
--     paid, mirroring the revenue side's `paid_at is not null` gate. For a
--     recurring cost, `auto_deduct` stands in for paid: every elapsed month in
--     its window is treated as paid and deducted straight from revenue.
--
-- The month-window arithmetic below is otherwise the old function verbatim,
-- reading project_costs. It is mirrored in project-cost.lib.ts — change both.
-- ----------------------------------------------------------------------------
create or replace function public.project_cost_cumulative(
  p_project_id uuid,
  p_period date
)
returns bigint
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(sum(
    case
      when c.kind = 'one_off' then
        case
          when c.period_month <= date_trunc('month', p_period)::date
            then c.amount_cents
          else 0
        end
      else -- recurring: amount_cents * months elapsed in [starts_on, min(ends_on, p_period)]
        case
          when c.starts_on <= date_trunc('month', p_period)::date then
            c.amount_cents * greatest(0,
              (extract(year from least(coalesce(c.ends_on, p_period), p_period))::int
                - extract(year from c.starts_on)::int) * 12
              + (extract(month from least(coalesce(c.ends_on, p_period), p_period))::int
                - extract(month from c.starts_on)::int)
              + 1
            )
          else 0
        end
    end
  ), 0)
  from public.project_costs c
  where c.project_id = p_project_id
    and c.kind in ('recurring', 'one_off')
    and c.active = true
    and c.deleted = false
    -- Paid-only gate: an auto-deducting recurring cost counts as paid every
    -- elapsed month; anything else must carry an explicit paid_at.
    and (c.paid_at is not null or (c.kind = 'recurring' and c.auto_deduct = true));
$$;

-- Mark one or more POOL costs paid/unpaid — a manager only, scoped to a single
-- company. Deliberately mirrors mark_revenue_entries_paid (20260727000000) so
-- the two sides of the pool are toggled the same way. Reimbursables are
-- excluded: they are paid via reimbursed_at, not paid_at.
create or replace function public.mark_project_costs_paid(
  p_cost_ids uuid[],
  p_paid boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  select distinct company_id into v_company_id
  from public.project_costs
  where id = any(p_cost_ids) and deleted = false;

  if v_company_id is null then
    raise exception 'No matching project costs';
  end if;

  if (select count(distinct company_id) from public.project_costs where id = any(p_cost_ids) and deleted = false) > 1 then
    raise exception 'Project costs must belong to a single company';
  end if;

  if not public.is_company_manager(v_company_id) then
    raise exception 'Only a manager can mark project costs paid';
  end if;

  if exists (
    select 1 from public.project_costs
    where id = any(p_cost_ids) and deleted = false and kind = 'reimbursable'
  ) then
    raise exception 'Reimbursable costs are settled via reimbursed_at, not paid_at';
  end if;

  update public.project_costs
  set paid_at = case when p_paid then now() else null end,
      updated_at = now()
  where id = any(p_cost_ids)
    and company_id = v_company_id
    and deleted = false;
end;
$$;

grant execute on function public.mark_project_costs_paid(uuid[], boolean) to authenticated;

-- Redefine settle_project_month to call project_cost_cumulative. Body copied
-- verbatim from 20260727000000_revenue_entry_paid_status.sql (the migration
-- holding the CURRENT definition — it gates the pool on paid revenue via
-- `paid_at is not null`); the ONLY change is the v_cum_fixed assignment.
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
  v_m date;
  v_month_rev bigint;
  v_ref record;
  v_running_paid bigint := 0;   -- total paid to invoices in strictly-earlier months
  v_carry jsonb := '{}'::jsonb;  -- freelancer_id -> carried-forward cents
  v_cum_rev bigint;
  v_cum_ref bigint;
  v_cum_fixed bigint;
  v_available bigint;
  v_inv record;
  v_brought bigint;
  v_due bigint;
  v_paid bigint;
  v_carried bigint;
  v_new_status public.invoice_status;
  v_minutes integer;
  v_earned bigint;
begin
  select company_id into v_company_id from public.projects where id = p_project_id;
  if v_company_id is null then
    raise exception 'Project not found';
  end if;
  if not public.is_company_manager(v_company_id) then
    raise exception 'Only a manager can settle a project month';
  end if;

  -- Serialize settlement per project: collapse concurrent/double-clicked settles
  -- into one and give this global read-then-write pass a stable point (auto-released
  -- at transaction end).
  perform pg_advisory_xact_lock(hashtext(p_project_id::text));

  -- Tell enforce_invoice_integrity that settlement (not a user) is writing the
  -- money columns. Transaction-local; resets automatically at transaction end.
  perform set_config('chrono.settling', 'on', true);

  -- (1) Recognize revenue for every month that has any activity, PLUS every month
  -- in an active recurring source's window up to the settled period (#3) — a
  -- retainer month with no logged time / invoice would otherwise never recognize.
  for v_m in
    select date_trunc('month', entry_date)::date from public.time_entries
      where project_id = p_project_id and deleted = false
    union
    select period_month from public.revenue_entries
      where project_id = p_project_id and deleted = false
    union
    select period_month from public.invoices
      where project_id = p_project_id and deleted = false
    union
    select date_trunc('month', p_period)::date
    union
    select gs::date
      from public.revenue_sources rs
      cross join lateral generate_series(
        date_trunc('month', rs.starts_on)::date,
        date_trunc('month', least(coalesce(rs.ends_on, p_period), p_period))::date,
        interval '1 month'
      ) gs
      where rs.project_id = p_project_id
        and rs.type = 'recurring'
        and rs.active = true
        and rs.deleted = false
        and rs.starts_on is not null
  loop
    perform public.recognize_project_revenue(p_project_id, v_m);
  end loop;

  -- Retire referral earnings whose referral is no longer active/in-window for
  -- that month (#2), so the pool stops subtracting money owed to nobody. Revived
  -- referrals are un-deleted by the upsert below.
  update public.referral_earnings rea
  set deleted = true, updated_at = now()
  where rea.project_id = p_project_id
    and rea.deleted = false
    and not exists (
      select 1 from public.project_referrals pr
      where pr.project_id = p_project_id and pr.company_id = v_company_id
        and pr.user_id = rea.referrer_id and pr.deleted = false
        and (pr.starts_on is null or pr.starts_on <= (rea.period_month + interval '1 month - 1 day')::date)
        and (pr.ends_on is null or pr.ends_on >= rea.period_month)
    );

  -- (2) Referral first-claim: recompute per month for every month with revenue.
  for v_m in
    select distinct period_month from public.revenue_entries
    where project_id = p_project_id and deleted = false
  loop
    select coalesce(sum(amount_cents), 0) into v_month_rev
    from public.revenue_entries
    where project_id = p_project_id and company_id = v_company_id
      and period_month = v_m and deleted = false;

    for v_ref in
      select * from public.project_referrals
      where project_id = p_project_id and company_id = v_company_id and deleted = false
        and (starts_on is null or starts_on <= (v_m + interval '1 month - 1 day')::date)
        and (ends_on is null or ends_on >= v_m)
    loop
      insert into public.referral_earnings
        (project_id, company_id, referrer_id, period_month, percent, revenue_base_cents, amount_cents, settled_at)
      values
        (p_project_id, v_company_id, v_ref.user_id, v_m, v_ref.percent, v_month_rev,
         round(v_month_rev * v_ref.percent / 100), now())
      on conflict (project_id, referrer_id, period_month)
        do update set percent = excluded.percent,
                      revenue_base_cents = excluded.revenue_base_cents,
                      amount_cents = excluded.amount_cents,
                      deleted = false,
                      settled_at = now(), updated_at = now();
    end loop;
  end loop;

  -- (3) Global settlement, months ascending; invoices FIFO within a month.
  for v_m in
    select distinct period_month from public.invoices
    where project_id = p_project_id and company_id = v_company_id and deleted = false
      and status in ('submitted', 'partially_paid', 'paid')
    order by 1 asc
  loop
    -- Only revenue the client has actually PAID counts toward the funding pool.
    select coalesce(sum(amount_cents), 0) into v_cum_rev
    from public.revenue_entries
    where project_id = p_project_id and company_id = v_company_id
      and period_month <= v_m and deleted = false
      and paid_at is not null;

    select coalesce(sum(amount_cents), 0) into v_cum_ref
    from public.referral_earnings
    where project_id = p_project_id and company_id = v_company_id
      and period_month <= v_m and deleted = false;

    v_cum_fixed := public.project_cost_cumulative(p_project_id, v_m);

    v_available := v_cum_rev - v_cum_ref - v_cum_fixed - v_running_paid;
    if v_available < 0 then v_available := 0; end if;

    for v_inv in
      select * from public.invoices
      where project_id = p_project_id and company_id = v_company_id
        and period_month = v_m and deleted = false
        and status in ('submitted', 'partially_paid', 'paid')
      order by submission_seq asc
    loop
      -- Recompute earned from the approved billable time this settle will tag to
      -- the invoice (#4), using the invoice's snapshot rate — so entries approved
      -- after submission are paid, not tagged-and-frozen-unpaid. Includes entries
      -- already tagged to this invoice so a re-settle is idempotent.
      select coalesce(sum(duration_minutes), 0) into v_minutes
      from public.time_entries te
      where te.project_id = p_project_id
        and te.user_id = v_inv.freelancer_id
        and te.status = 'approved' and te.billable = true and te.deleted = false
        and (te.invoice_id is null or te.invoice_id = v_inv.id)
        and te.entry_date >= v_m
        and te.entry_date < (v_m + interval '1 month')::date;

      v_earned := round(v_minutes::numeric / (v_inv.hours_per_day * 60) * v_inv.tjm_cents);

      v_brought := coalesce((v_carry ->> v_inv.freelancer_id::text)::bigint, 0);
      v_due := v_earned + v_brought;
      v_paid := least(v_available, v_due);
      if v_paid < 0 then v_paid := 0; end if;
      v_available := v_available - v_paid;
      v_running_paid := v_running_paid + v_paid;
      v_carried := v_due - v_paid;
      v_carry := jsonb_set(v_carry, array[v_inv.freelancer_id::text], to_jsonb(v_carried));

      if v_paid >= v_due then
        v_new_status := 'paid';
      elsif v_paid > 0 then
        v_new_status := 'partially_paid';
      else
        v_new_status := 'submitted';
      end if;

      update public.invoices
      set worked_minutes = v_minutes,
          earned_cents = v_earned,
          credit_brought_forward_cents = v_brought,
          amount_due_cents = v_due,
          amount_paid_cents = v_paid,
          credit_carried_forward_cents = v_carried,
          funding_snapshot_cents = v_cum_rev - v_cum_ref - v_cum_fixed,
          status = v_new_status,
          settled_at = now(),
          updated_at = now()
      where id = v_inv.id;

      update public.time_entries
      set invoice_id = v_inv.id, updated_at = now()
      where project_id = p_project_id
        and user_id = v_inv.freelancer_id
        and status = 'approved' and billable = true and deleted = false
        and (invoice_id is null or invoice_id = v_inv.id)
        and entry_date >= v_m
        and entry_date < (v_m + interval '1 month')::date;
    end loop;
  end loop;

  perform set_config('chrono.settling', 'off', true);
end;
$$;

-- ----------------------------------------------------------------------------
-- Retire the old surface. Order matters: settle_project_month above no longer
-- references project_fixed_cost_cumulative, so it can go; the old triggers die
-- with their tables. The receipts bucket and its policies are untouched — the
-- paths still resolve because ids were preserved.
-- ----------------------------------------------------------------------------
drop function if exists public.project_fixed_cost_cumulative(uuid, date);
drop function if exists public.notify_expense_submitted() cascade;
drop function if exists public.notify_expense_reviewed() cascade;
drop function if exists public.on_expense_status_change() cascade;

drop table if exists public.project_fixed_costs;
drop table if exists public.project_expenses;

-- expense_status is still in use (project_costs.status); only the cadence enum
-- is now unreferenced.
drop type if exists public.fixed_cost_cadence;
