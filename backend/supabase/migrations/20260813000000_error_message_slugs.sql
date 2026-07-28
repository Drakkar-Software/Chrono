-- Error messages become stable slugs.
--
-- DB functions must never raise user-facing copy: the app is translated (en/fr)
-- and prose raised here cannot be localized. Every `raise exception` below now
-- carries a slug; values that used to be interpolated into the sentence are
-- appended as `:value` segments (e.g. `capacity-exceeded:7`). The client parses
-- and translates them — see `parseDbError` in @chrono/sdk and the `db.*` catalog
-- keys in the mobile app.
--
-- Each function below is its previous definition with only the raised literals
-- changed; behaviour is otherwise untouched. `create or replace` keeps existing
-- grants, so the privilege blocks from the original migrations still apply.

-- public.enforce_role_change_rules (from 20260807000000_invite_admin_accept.sql)
create or replace function public.enforce_role_change_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Invite redeem path: allow admin-tier INSERT only (not UPDATE).
  if tg_op = 'INSERT'
     and current_setting('chrono.accepting_invite', true) = 'on' then
    return new;
  end if;

  -- (b) admin-tier changes require an existing admin (except the bootstrap row).
  if (new.role = 'admin'
      or (tg_op = 'UPDATE' and old.role = 'admin' and new.role is distinct from old.role))
     and not public.is_company_admin(new.company_id)
     and exists (
       select 1 from public.company_members cm
       where cm.company_id = new.company_id and cm.id is distinct from new.id
     ) then
    raise exception 'role-admin-grant-forbidden';
  end if;

  -- (a) no self-escalation.
  if tg_op = 'UPDATE'
     and new.role is distinct from old.role
     and new.user_id = (select auth.uid())
     and not public.is_company_admin(new.company_id) then
    raise exception 'role-change-forbidden';
  end if;

  return new;
end;
$$;

-- public.prevent_invoiced_entry_edit (from 20260713000000_initial.sql)
create or replace function public.prevent_invoiced_entry_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.invoice_id is not null and new.invoice_id is not null
     and (new.duration_minutes is distinct from old.duration_minutes
          or new.billable is distinct from old.billable
          or new.status is distinct from old.status
          or new.entry_date is distinct from old.entry_date) then
    raise exception 'time-entry-invoiced-locked';
  end if;
  return new;
end;
$$;

-- public.enforce_referral_total (from 20260713000000_initial.sql)
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
    raise exception 'referral-total-exceeded:%', total + new.percent;
  end if;
  return new;
end;
$$;

-- public.enforce_invoice_integrity (from 20260714000000_notifications_billing_invites.sql)
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
    raise exception 'invoice-company-mismatch';
  end if;

  if current_setting('chrono.settling', true) = 'on' then
    return new;
  end if;

  if not public.is_company_manager(new.company_id) then
    if new.freelancer_id <> (select auth.uid()) then
      raise exception 'invoice-foreign-user';
    end if;
    if not public.is_project_member(new.project_id) then
      raise exception 'invoice-invalid-project';
    end if;
    if new.status not in ('draft', 'submitted') then
      raise exception 'invoice-freelancer-status-forbidden';
    end if;
  else
    if new.status not in ('draft', 'submitted', 'cancelled') then
      raise exception 'invoice-settlement-status-reserved';
    end if;
    if tg_op = 'UPDATE'
       and old.status in ('paid', 'partially_paid')
       and new.status in ('draft', 'submitted') then
      raise exception 'invoice-settled-immutable';
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

-- public.recognize_project_revenue (from 20260806000000_revenue_entry_corrections.sql)
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
    raise exception 'project-not-found';
  end if;

  if not public.is_company_manager(v_company_id) then
    raise exception 'revenue-recognize-forbidden';
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
    elsif v_src.type = 'time_based' and (v_src.content ? 'manual_amount_cents') then
      v_amount := coalesce((v_src.content ->> 'manual_amount_cents')::bigint, 0);
    else
      select coalesce(sum(duration_minutes), 0) into v_billable_minutes
      from public.time_entries
      where project_id = p_project_id
        and company_id = v_company_id
        and billable = true
        and status = 'approved'
        and deleted = false
        and entry_date >= v_period
        and entry_date < (v_period + interval '1 month')::date;

      v_billable_days := v_billable_minutes::numeric / (v_hours_per_day * 60);
      v_client_tjm := coalesce((v_src.content ->> 'client_tjm_cents')::integer, 0);
      v_amount := round(v_billable_days * v_client_tjm);

      if v_src.type = 'self_billing' then
        v_markup := coalesce((v_src.content ->> 'markup_pct')::numeric, 0);
        v_amount := round(v_amount * (1 + v_markup / 100));
      end if;
    end if;

    -- Auto recognition never invents negatives; zero means retire any auto row.
    if v_amount < 0 then v_amount := 0; end if;

    if v_amount = 0 then
      update public.revenue_entries
        set deleted = true, updated_at = now()
      where revenue_source_id = v_src.id
        and period_month = v_period
        and auto_generated = true
        and deleted = false;
    else
      insert into public.revenue_entries
        (project_id, company_id, revenue_source_id, type, period_month, amount_cents, auto_generated)
      values
        (p_project_id, v_company_id, v_src.id, v_src.type, v_period, v_amount, true)
      on conflict (revenue_source_id, period_month)
        where (auto_generated and not deleted)
        do update set
          amount_cents = excluded.amount_cents,
          updated_at = now()
        where public.revenue_entries.auto_generated = true
          and public.revenue_entries.deleted = false;
    end if;
  end loop;

  -- Retire auto-generated revenue for THIS month whose source is no longer
  -- active/in-window. Corrections (auto_generated = false) are left untouched.
  -- Skip autos that still have a live correction for the same source×month —
  -- soft-deleting only the positive leg would orphan the negative and either
  -- understate revenue or trip the net-non-negative trigger.
  update public.revenue_entries re
  set deleted = true, updated_at = now()
  where re.project_id = p_project_id
    and re.period_month = v_period
    and re.deleted = false
    and re.auto_generated = true
    and not exists (
      select 1 from public.revenue_sources rs
      where rs.id = re.revenue_source_id
        and rs.active = true and rs.deleted = false
        and (rs.starts_on is null or rs.starts_on <= (v_period + interval '1 month - 1 day')::date)
        and (rs.ends_on is null or rs.ends_on >= v_period)
    )
    and not exists (
      select 1 from public.revenue_entries corr
      where corr.revenue_source_id = re.revenue_source_id
        and corr.period_month = re.period_month
        and corr.deleted = false
        and corr.auto_generated = false
        and corr.amount_cents < 0
    );
end;
$$;

-- public.settle_project_month (from 20260806000000_revenue_entry_corrections.sql)
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
    raise exception 'project-not-found';
  end if;
  if not public.is_company_manager(v_company_id) then
    raise exception 'settle-forbidden';
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
         greatest(0, round(v_month_rev * v_ref.percent / 100)), now())
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

      -- Corrections can net below zero in edge cases; never invent a negative invoice.
      v_minutes := greatest(0, v_minutes);
      v_earned := round(v_minutes::numeric / (v_inv.hours_per_day * 60) * v_inv.tjm_cents);

      v_brought := coalesce((v_carry ->> v_inv.freelancer_id::text)::bigint, 0);
      v_due := greatest(0, v_earned + v_brought);
      v_paid := least(v_available, v_due);
      if v_paid < 0 then v_paid := 0; end if;
      v_available := v_available - v_paid;
      v_running_paid := v_running_paid + v_paid;
      v_carried := v_due - v_paid;
      v_carry := jsonb_set(v_carry, array[v_inv.freelancer_id::text], to_jsonb(v_carried));

      if v_due > 0 and v_paid >= v_due then
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

-- public.enforce_invite_update_rules (from 20260714000000_notifications_billing_invites.sql)
create or replace function public.enforce_invite_update_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.company_id is distinct from old.company_id
     or new.token is distinct from old.token
     or new.invited_by is distinct from old.invited_by then
    raise exception 'invite-identity-immutable';
  end if;

  if new.role is distinct from old.role
     and new.role <> 'freelancer'
     and not public.is_company_admin(new.company_id) then
    raise exception 'invite-role-forbidden';
  end if;

  return new;
end;
$$;

-- public.mark_revenue_entries_paid (from 20260727000000_revenue_entry_paid_status.sql)
create or replace function public.mark_revenue_entries_paid(
  p_entry_ids uuid[],
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
  from public.revenue_entries
  where id = any(p_entry_ids) and deleted = false;

  if v_company_id is null then
    raise exception 'revenue-entries-not-found';
  end if;

  if (select count(distinct company_id) from public.revenue_entries where id = any(p_entry_ids) and deleted = false) > 1 then
    raise exception 'revenue-entries-multi-company';
  end if;

  if not public.is_company_manager(v_company_id) then
    raise exception 'revenue-paid-forbidden';
  end if;

  update public.revenue_entries
  set paid_at = case when p_paid then now() else null end,
      updated_at = now()
  where id = any(p_entry_ids)
    and company_id = v_company_id
    and deleted = false;
end;
$$;

-- public.enforce_seat_limit (from 20260811000000_invite_revive_soft_deleted.sql)
create or replace function public.enforce_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  if new.deleted then
    return new;
  end if;

  -- Already holding an active seat (idempotent accept / ON CONFLICT): not a new seat.
  if exists (
    select 1
    from public.company_members cm
    where cm.company_id = new.company_id
      and cm.user_id = new.user_id
      and cm.deleted = false
  ) then
    return new;
  end if;

  select seat_limit into v_limit
  from public.company_subscriptions
  where company_id = new.company_id;

  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count
  from public.company_members
  where company_id = new.company_id and deleted = false;

  if v_count >= v_limit then
    raise exception 'seat-limit-reached:%', v_limit;
  end if;

  return new;
end;
$$;

-- public.mark_project_costs_paid (from 20260802000000_unify_project_costs.sql)
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
    raise exception 'project-costs-not-found';
  end if;

  if (select count(distinct company_id) from public.project_costs where id = any(p_cost_ids) and deleted = false) > 1 then
    raise exception 'project-costs-multi-company';
  end if;

  if not public.is_company_manager(v_company_id) then
    raise exception 'project-costs-paid-forbidden';
  end if;

  if exists (
    select 1 from public.project_costs
    where id = any(p_cost_ids) and deleted = false and kind = 'reimbursable'
  ) then
    raise exception 'project-cost-reimbursable-not-payable';
  end if;

  update public.project_costs
  set paid_at = case when p_paid then now() else null end,
      updated_at = now()
  where id = any(p_cost_ids)
    and company_id = v_company_id
    and deleted = false;
end;
$$;

-- public.compute_rem_month (from 20260809000000_rem_review_fixes.sql)
create or replace function public.compute_rem_month(
  p_company_id uuid,
  p_period date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month_id uuid;
  v_status public.rem_month_status;
  v_period date := date_trunc('month', p_period)::date;
  v_fee_pct numeric;
  v_max_pct numeric;
  v_license_pct numeric;
  v_hpd_default numeric;
  v_capacity_days numeric := 22;
  v_proj record;
  v_direct bigint;
  v_maint bigint;
  v_costs bigint;
  v_after_costs bigint;
  v_fee bigint;
  v_net bigint;
  v_partner record;
  v_total_weight numeric;
  v_amount bigint;
  v_rev bigint;
  v_license bigint;
  v_referral bigint;
  v_pool bigint;
  v_ref_pct numeric;
  v_src_license numeric;
  v_hpd numeric;
  v_tjm integer;
  v_days numeric;
  v_queued bigint;
  v_paid_rev bigint;
  v_left bigint;
  v_q record;
  v_take bigint;
  v_partner_count integer;
  v_license_each bigint;
  v_fee_total bigint := 0;
  v_excess numeric;
  v_uncapped_raw numeric;
  v_iter integer;
  v_sum_raw numeric;
  v_ord integer;
  v_shares jsonb;
  v_contract_days numeric;
  v_weight_days numeric;
  v_lic_rev bigint;
begin
  if not public.is_company_manager(p_company_id) then
    raise exception 'rem-compute-forbidden';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_company_id::text || v_period::text));

  select company_fee_pct, rem_max_percent / 100.0, default_license_pct,
         coalesce(default_hours_per_day, 8)
    into v_fee_pct, v_max_pct, v_license_pct, v_hpd_default
  from public.companies where id = p_company_id and deleted = false;
  if not found then
    raise exception 'company-not-found';
  end if;
  v_fee_pct := coalesce(v_fee_pct, 5);
  v_max_pct := coalesce(v_max_pct, 0.75);
  v_license_pct := coalesce(v_license_pct, 30);

  insert into public.rem_months (company_id, period_month, status)
  values (p_company_id, v_period, 'draft')
  on conflict (company_id, period_month) do update
    set updated_at = now()
  returning id, status into v_month_id, v_status;

  if v_status = 'locked' then
    raise exception 'rem-month-locked';
  end if;

  delete from public.rem_lines where month_id = v_month_id;

  -- ---- product_pool: (direct + maintenance − costs) → fee → residual capped split ----
  v_direct := 0;
  v_maint := 0;
  v_costs := 0;

  select coalesce(sum(case when rs.rem_kind = 'direct_sales' or rs.rem_kind is null then re.amount_cents else 0 end), 0),
         coalesce(sum(case when rs.rem_kind = 'maintenance' then re.amount_cents else 0 end), 0)
    into v_direct, v_maint
  from public.revenue_entries re
  join public.projects p on p.id = re.project_id
  left join public.revenue_sources rs on rs.id = re.revenue_source_id
  where re.company_id = p_company_id
    and re.period_month = v_period
    and re.deleted = false
    and re.paid_at is not null
    and p.rem_policy = 'product_pool'
    and p.deleted = false;

  select coalesce(sum(
    case
      when pc.kind in ('recurring', 'one_off')
           and (pc.paid_at is not null or coalesce(pc.auto_deduct, false))
      then pc.amount_cents else 0 end
  ), 0) into v_costs
  from public.project_costs pc
  join public.projects p on p.id = pc.project_id
  where pc.company_id = p_company_id
    and p.rem_policy = 'product_pool'
    and p.deleted = false
    and pc.deleted = false
    and pc.active = true
    and (
      (pc.kind = 'one_off' and pc.period_month = v_period)
      or (
        pc.kind = 'recurring'
        and pc.starts_on is not null
        and date_trunc('month', pc.starts_on)::date <= v_period
        and (pc.ends_on is null or date_trunc('month', pc.ends_on)::date >= v_period)
      )
    );

  v_after_costs := greatest(0, v_direct + v_maint - v_costs);
  v_fee := public.rem_round_cents(v_after_costs * v_fee_pct / 100.0);
  v_net := greatest(0, v_after_costs - v_fee);
  v_fee_total := v_fee_total + v_fee;

  if v_fee > 0 then
    insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
    values (v_month_id, p_company_id, null, null, 'company_fee', v_fee,
            jsonb_build_object('source', 'product_pool', 'gross', v_direct + v_maint, 'costs', v_costs));
  end if;

  if v_net > 0 then
    create temporary table if not exists _rem_shares (
      user_id uuid primary key,
      raw numeric not null default 0,
      max_f numeric not null,
      share numeric not null default 0
    ) on commit drop;
    truncate _rem_shares;

    -- Residual OctoBot weight: max(0, 22 − staffing_contract_days) per rem_partner.
    for v_partner in
      select cm.user_id,
             least(coalesce(cm.rem_max_percent, v_max_pct * 100) / 100.0, v_max_pct) as max_f
      from public.company_members cm
      where cm.company_id = p_company_id and cm.deleted = false and cm.rem_partner = true
    loop
      select coalesce(sum(
        te.duration_minutes::numeric / nullif(coalesce(p.hours_per_day, v_hpd_default) * 60, 0)
      ), 0) into v_contract_days
      from public.time_entries te
      join public.projects p on p.id = te.project_id
      where te.company_id = p_company_id
        and te.user_id = v_partner.user_id
        and te.deleted = false and te.status = 'approved'
        and p.deleted = false
        and p.rem_policy in ('staffing', 'external_tjm')
        and date_trunc('month', te.entry_date)::date = v_period;

      v_weight_days := greatest(0, least(v_capacity_days, v_capacity_days - greatest(0, v_contract_days)));
      insert into _rem_shares (user_id, raw, max_f, share)
      values (v_partner.user_id, v_weight_days, v_partner.max_f, 0)
      on conflict (user_id) do update set raw = excluded.raw, max_f = excluded.max_f;
    end loop;

    select coalesce(sum(raw), 0) into v_sum_raw from _rem_shares;
    select count(*) into v_partner_count from _rem_shares;

    if v_partner_count = 0 then
      null;
    elsif v_sum_raw <= 0 then
      v_shares := (
        select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'share', 1.0 / v_partner_count) order by user_id), '[]'::jsonb)
        from _rem_shares
      );
      for v_partner in
        select * from public.rem_split_by_shares(v_net, v_shares)
      loop
        if v_partner.amount_cents <> 0 then
          insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
          values (v_month_id, p_company_id, v_partner.user_id, null, 'product_pool', v_partner.amount_cents,
                  jsonb_build_object('equal_split', true, 'net', v_net, 'residual', true));
        end if;
      end loop;
    else
      update _rem_shares set raw = raw / v_sum_raw, share = raw / v_sum_raw;

      for v_iter in 1..16 loop
        select coalesce(sum(greatest(0, share - max_f)), 0) into v_excess from _rem_shares;
        exit when v_excess <= 1e-12;
        update _rem_shares set share = max_f where share > max_f;
        select coalesce(sum(raw), 0) into v_uncapped_raw
        from _rem_shares where share < max_f - 1e-12;
        if v_uncapped_raw <= 1e-12 then
          update _rem_shares set share = share / nullif((select sum(share) from _rem_shares), 0);
          exit;
        end if;
        update _rem_shares
          set share = share + v_excess * (raw / v_uncapped_raw)
          where share < max_f - 1e-12;
      end loop;

      v_shares := (
        select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'share', share) order by user_id), '[]'::jsonb)
        from _rem_shares
      );
      for v_partner in
        select * from public.rem_split_by_shares(v_net, v_shares)
      loop
        if v_partner.amount_cents <> 0 then
          insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
          values (v_month_id, p_company_id, v_partner.user_id, null, 'product_pool', v_partner.amount_cents,
                  jsonb_build_object('net', v_net, 'residual', true));
        end if;
      end loop;
    end if;
  end if;

  -- ---- product_service projects (per project) ----
  for v_proj in
    select id, coalesce(
      (select (content->>'license_pct')::numeric from public.revenue_sources
       where project_id = projects.id and rem_kind = 'product_service' and deleted = false
       limit 1),
      v_license_pct
    ) as lic_pct
    from public.projects
    where company_id = p_company_id and deleted = false and rem_policy = 'product_service'
  loop
    select coalesce(sum(re.amount_cents), 0) into v_rev
    from public.revenue_entries re
    where re.project_id = v_proj.id
      and re.period_month = v_period
      and re.deleted = false
      and re.paid_at is not null;

    v_fee := public.rem_round_cents(v_rev * v_fee_pct / 100.0);
    v_src_license := coalesce(v_proj.lic_pct, v_license_pct);
    v_license := public.rem_round_cents((v_rev - v_fee) * v_src_license / 100.0);

    select coalesce(sum(pr.percent), 0) into v_ref_pct
    from public.project_referrals pr
    where pr.project_id = v_proj.id and pr.deleted = false
      and (pr.starts_on is null or pr.starts_on <= (v_period + interval '1 month - 1 day')::date)
      and (pr.ends_on is null or pr.ends_on >= v_period);

    v_referral := public.rem_round_cents(v_rev * v_ref_pct / 100.0);
    v_pool := greatest(0, v_rev - v_fee - v_license - v_referral);
    v_fee_total := v_fee_total + v_fee;

    if v_fee > 0 then
      insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
      values (v_month_id, p_company_id, null, v_proj.id, 'company_fee', v_fee,
              jsonb_build_object('source', 'product_service'));
    end if;

    select coalesce(sum(w), 0)::numeric into v_total_weight
    from (
      select greatest(0, sum(duration_minutes))::numeric as w
      from public.time_entries
      where project_id = v_proj.id and deleted = false and status = 'approved'
        and date_trunc('month', entry_date)::date = v_period
      group by user_id
    ) weights;

    if v_pool > 0 and v_total_weight > 0 then
      v_shares := (
        select coalesce(jsonb_agg(
          jsonb_build_object('user_id', user_id, 'share', w / v_total_weight)
          order by user_id
        ), '[]'::jsonb)
        from (
          select user_id, greatest(0, sum(duration_minutes))::numeric as w
          from public.time_entries
          where project_id = v_proj.id and deleted = false and status = 'approved'
            and date_trunc('month', entry_date)::date = v_period
          group by user_id
          having sum(duration_minutes) > 0
        ) weights
      );
      for v_partner in
        select * from public.rem_split_by_shares(v_pool, v_shares)
      loop
        if v_partner.amount_cents <> 0 then
          insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
          values (v_month_id, p_company_id, v_partner.user_id, v_proj.id, 'product_service', v_partner.amount_cents,
                  jsonb_build_object('pool', v_pool));
        end if;
      end loop;
    end if;

    -- License 50/50 among rem_license_recipient (require exactly 2)
    select count(*) into v_partner_count
    from public.company_members
    where company_id = p_company_id and deleted = false and rem_license_recipient = true;
    if v_license > 0 then
      if v_partner_count <> 2 then
        raise exception 'rem-license-recipients-invalid:%', v_partner_count;
      end if;
      v_ord := 0;
      for v_partner in
        select user_id from public.company_members
        where company_id = p_company_id and deleted = false and rem_license_recipient = true
        order by user_id
      loop
        select amount_cents into v_license_each
        from public.rem_equal_split_amounts(v_license, 2)
        where ord = v_ord;
        insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
        values (v_month_id, p_company_id, v_partner.user_id, v_proj.id, 'license', coalesce(v_license_each, 0),
                jsonb_build_object('license_total', v_license, 'recipients', 2));
        v_ord := v_ord + 1;
      end loop;
    end if;

    -- Referral to referrers (gross basis); largest-remainder across referrers
    if v_referral > 0 then
      v_shares := (
        select coalesce(jsonb_agg(
          jsonb_build_object('user_id', user_id, 'share', percent) order by user_id
        ), '[]'::jsonb)
        from public.project_referrals
        where project_id = v_proj.id and deleted = false
          and (starts_on is null or starts_on <= (v_period + interval '1 month - 1 day')::date)
          and (ends_on is null or ends_on >= v_period)
      );
      for v_partner in
        select * from public.rem_split_by_shares(v_referral, v_shares)
      loop
        if v_partner.amount_cents <> 0 then
          insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
          values (v_month_id, p_company_id, v_partner.user_id, v_proj.id, 'referral', v_partner.amount_cents,
                  jsonb_build_object('referral_total', v_referral));
        end if;
      end loop;
    end if;
  end loop;

  -- ---- standalone license rem_kind revenue (50/50) ----
  select coalesce(sum(re.amount_cents), 0) into v_lic_rev
  from public.revenue_entries re
  join public.projects p on p.id = re.project_id
  join public.revenue_sources rs on rs.id = re.revenue_source_id
  where re.company_id = p_company_id
    and re.period_month = v_period
    and re.deleted = false
    and re.paid_at is not null
    and p.deleted = false
    and rs.deleted = false
    and rs.rem_kind = 'license'
    and p.rem_policy is distinct from 'product_service';

  if v_lic_rev > 0 then
    v_fee := public.rem_round_cents(v_lic_rev * v_fee_pct / 100.0);
    v_license := greatest(0, v_lic_rev - v_fee);
    v_fee_total := v_fee_total + v_fee;
    if v_fee > 0 then
      insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
      values (v_month_id, p_company_id, null, null, 'company_fee', v_fee,
              jsonb_build_object('source', 'license'));
    end if;
    select count(*) into v_partner_count
    from public.company_members
    where company_id = p_company_id and deleted = false and rem_license_recipient = true;
    if v_partner_count <> 2 then
      raise exception 'rem-license-recipients-invalid:%', v_partner_count;
    end if;
    v_ord := 0;
    for v_partner in
      select user_id from public.company_members
      where company_id = p_company_id and deleted = false and rem_license_recipient = true
      order by user_id
    loop
      select amount_cents into v_license_each
      from public.rem_equal_split_amounts(v_license, 2)
      where ord = v_ord;
      insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
      values (v_month_id, p_company_id, v_partner.user_id, null, 'license', coalesce(v_license_each, 0),
              jsonb_build_object('license_total', v_license, 'source', 'standalone'));
      v_ord := v_ord + 1;
    end loop;
  end if;

  -- ---- staffing: days × TJM (− referral); fee on paid client revenue ----
  for v_proj in
    select id, hours_per_day, default_tjm_cents
    from public.projects
    where company_id = p_company_id and deleted = false
      and rem_policy in ('staffing', 'external_tjm')
  loop
    v_hpd := coalesce(v_proj.hours_per_day, v_hpd_default);
    select coalesce(sum(pr.percent), 0) into v_ref_pct
    from public.project_referrals pr
    where pr.project_id = v_proj.id and pr.deleted = false
      and (pr.starts_on is null or pr.starts_on <= (v_period + interval '1 month - 1 day')::date)
      and (pr.ends_on is null or pr.ends_on >= v_period);

    select coalesce(sum(amount_cents), 0) into v_paid_rev
    from public.revenue_entries
    where project_id = v_proj.id and period_month = v_period
      and deleted = false and paid_at is not null;

    v_fee := public.rem_round_cents(v_paid_rev * v_fee_pct / 100.0);
    if v_fee > 0 then
      v_fee_total := v_fee_total + v_fee;
      insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
      values (v_month_id, p_company_id, null, v_proj.id, 'company_fee', v_fee,
              jsonb_build_object('source', 'staffing', 'paid_revenue', v_paid_rev));
    end if;

    for v_partner in
      select te.user_id,
             sum(te.duration_minutes)::integer as minutes,
             coalesce(pm.tjm_cents, v_proj.default_tjm_cents, 0) as tjm
      from public.time_entries te
      left join public.project_members pm
        on pm.project_id = te.project_id and pm.user_id = te.user_id and pm.deleted = false
      where te.project_id = v_proj.id
        and te.deleted = false and te.status = 'approved'
        and date_trunc('month', te.entry_date)::date = v_period
      group by te.user_id, pm.tjm_cents
    loop
      if v_hpd > 0 and v_partner.tjm > 0 then
        v_amount := public.rem_round_cents(
          (v_partner.minutes::numeric / (v_hpd * 60)) * v_partner.tjm
        );
        v_referral := 0;
        if v_ref_pct > 0 then
          -- Referral carve-out from gross TJM (same basis as paid-revenue referral funding).
          v_referral := public.rem_round_cents(v_amount * v_ref_pct / 100.0);
          v_amount := v_amount - v_referral;
        end if;
        if v_amount <> 0 then
          insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
          values (v_month_id, p_company_id, v_partner.user_id, v_proj.id, 'staffing_tjm', v_amount,
                  jsonb_build_object(
                    'minutes', v_partner.minutes,
                    'tjm', v_partner.tjm,
                    'referral_cut', v_referral,
                    'referral_pct', v_ref_pct
                  ));
        end if;
      end if;
    end loop;
  end loop;

  -- ---- jungle: restore prior settlements for this period, then re-enqueue ----
  perform public._chrono_restore_jungle_period(p_company_id, v_period);

  for v_proj in
    select id, jungle_fictitious_tjm_cents, hours_per_day, company_id
    from public.projects
    where company_id = p_company_id and deleted = false and rem_policy = 'jungle'
  loop
    v_hpd := coalesce(v_proj.hours_per_day, v_hpd_default);
    v_tjm := coalesce(v_proj.jungle_fictitious_tjm_cents, 0);
    for v_partner in
      select user_id, greatest(0, sum(duration_minutes))::integer as minutes
      from public.time_entries
      where project_id = v_proj.id and deleted = false and status = 'approved'
        and date_trunc('month', entry_date)::date = v_period
      group by user_id
      having sum(duration_minutes) > 0
    loop
      if v_tjm > 0 and v_hpd > 0 then
        v_days := v_partner.minutes::numeric / (v_hpd * 60);
        v_queued := public.rem_round_cents(v_days * v_tjm);
        if v_queued > 0 then
          insert into public.jungle_tjm_queue_entries (
            company_id, project_id, user_id, period_month, days,
            fictitious_tjm_cents, queued_cents, remaining_cents
          ) values (
            p_company_id, v_proj.id, v_partner.user_id, v_period, v_days,
            v_tjm, v_queued, v_queued
          );
        end if;
      end if;
    end loop;

    select coalesce(sum(amount_cents), 0) into v_paid_rev
    from public.revenue_entries
    where project_id = v_proj.id and period_month = v_period
      and deleted = false and paid_at is not null;

    v_fee := public.rem_round_cents(v_paid_rev * v_fee_pct / 100.0);
    if v_fee > 0 then
      v_fee_total := v_fee_total + v_fee;
      insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
      values (v_month_id, p_company_id, null, v_proj.id, 'company_fee', v_fee,
              jsonb_build_object('source', 'jungle', 'paid_revenue', v_paid_rev));
    end if;

    v_left := greatest(0, v_paid_rev - v_fee);
    for v_q in
      select * from public.jungle_tjm_queue_entries
      where project_id = v_proj.id and deleted = false and remaining_cents > 0
      order by seq, id
    loop
      exit when v_left <= 0;
      v_take := least(v_q.remaining_cents, v_left);
      update public.jungle_tjm_queue_entries
        set remaining_cents = remaining_cents - v_take, updated_at = now()
        where id = v_q.id;
      insert into public.jungle_tjm_queue_settlements (company_id, queue_entry_id, period_month, amount_cents)
      values (p_company_id, v_q.id, v_period, v_take);
      insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
      values (v_month_id, p_company_id, v_q.user_id, v_proj.id, 'jungle_dequeue', v_take,
              jsonb_build_object('queue_entry_id', v_q.id));
      v_left := v_left - v_take;
    end loop;
  end loop;

  insert into public.company_fee_reserve_ledger (company_id, period_month, amount_cents, meta)
  values (p_company_id, v_period, v_fee_total, jsonb_build_object('month_id', v_month_id))
  on conflict (company_id, period_month) do update
    set amount_cents = excluded.amount_cents,
        meta = excluded.meta;

  update public.rem_months
    set status = 'computed', computed_at = now(), updated_at = now()
    where id = v_month_id;

  return v_month_id;
end;
$$;

-- public.lock_rem_month (from 20260803000000_unified_rem.sql)
create or replace function public.lock_rem_month(
  p_company_id uuid,
  p_period date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
begin
  if not public.is_company_manager(p_company_id) then
    raise exception 'rem-lock-forbidden';
  end if;
  update public.rem_months
    set status = 'locked', updated_at = now()
  where company_id = p_company_id and period_month = v_period;
  if not found then
    raise exception 'rem-month-not-computed';
  end if;
end;
$$;

-- public.settle_project_month_with_rem (from 20260809000000_rem_review_fixes.sql)
create or replace function public.settle_project_month_with_rem(
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
  v_policy public.rem_policy;
  v_period date := date_trunc('month', p_period)::date;
  v_month_id uuid;
  v_line record;
  v_pool_project uuid;
  v_earn bigint;
  v_avail bigint;
  v_paid bigint;
  v_hpd numeric;
begin
  select company_id, rem_policy into v_company_id, v_policy
  from public.projects where id = p_project_id;
  if v_company_id is null then
    raise exception 'project-not-found';
  end if;

  select product_pool_project_id,
         coalesce(default_hours_per_day, 8)
    into v_pool_project, v_hpd
  from public.companies where id = v_company_id;

  if v_pool_project is null then
    select id into v_pool_project
    from public.projects
    where company_id = v_company_id and deleted = false and rem_policy = 'product_pool'
    order by created_at, id
    limit 1;
  end if;

  perform public.settle_project_month(p_project_id, p_period);

  begin
    v_month_id := public.compute_rem_month(v_company_id, v_period);
  exception
    when raise_exception then
      if SQLERRM like '%locked%' then
        return;
      end if;
      raise;
  end;

  if v_policy is distinct from 'staffing' and v_policy is distinct from 'external_tjm' then
    perform set_config('chrono.settling', 'on', true);

    for v_line in
      select user_id,
             coalesce(project_id, p_project_id) as project_id,
             sum(amount_cents)::bigint as earned
      from public.rem_lines
      where month_id = v_month_id
        and user_id is not null
        and bucket not in ('company_fee', 'staffing_tjm')
        and (
          (project_id = p_project_id)
          or (
            project_id is null
            and bucket = 'product_pool'
            and v_policy = 'product_pool'
            and p_project_id = v_pool_project
          )
        )
      group by user_id, coalesce(project_id, p_project_id)
    loop
      if v_line.earned <= 0 then continue; end if;
      insert into public.invoices (
        company_id, project_id, freelancer_id, period_month,
        worked_minutes, tjm_cents, hours_per_day,
        earned_cents, credit_brought_forward_cents, amount_due_cents,
        amount_paid_cents, credit_carried_forward_cents,
        status, submitted_at
      ) values (
        v_company_id, v_line.project_id, v_line.user_id, v_period,
        0, 0, v_hpd,
        v_line.earned, 0, v_line.earned,
        0, 0,
        'submitted', now()
      )
      on conflict (project_id, freelancer_id, period_month)
      do update set
        earned_cents = excluded.earned_cents,
        amount_due_cents = excluded.earned_cents + public.invoices.credit_brought_forward_cents,
        status = case
          when public.invoices.status in ('paid', 'partially_paid') then public.invoices.status
          else 'submitted'
        end,
        submitted_at = coalesce(public.invoices.submitted_at, now()),
        updated_at = now()
      where public.invoices.deleted = false;
    end loop;

    select coalesce(sum(amount_cents), 0) into v_avail
    from public.revenue_entries
    where project_id = p_project_id and period_month = v_period
      and deleted = false and paid_at is not null;

    for v_line in
      select id, amount_due_cents, amount_paid_cents
      from public.invoices
      where project_id = p_project_id and period_month = v_period
        and deleted = false and status in ('submitted', 'partially_paid')
      order by submission_seq
    loop
      exit when v_avail <= 0;
      v_earn := greatest(0, v_line.amount_due_cents - coalesce(v_line.amount_paid_cents, 0));
      v_paid := least(v_avail, v_earn);
      update public.invoices
      set amount_paid_cents = coalesce(amount_paid_cents, 0) + v_paid,
          credit_carried_forward_cents = amount_due_cents - (coalesce(amount_paid_cents, 0) + v_paid),
          status = case
            when amount_due_cents > 0
              and coalesce(amount_paid_cents, 0) + v_paid >= amount_due_cents
              then 'paid'::public.invoice_status
            when coalesce(amount_paid_cents, 0) + v_paid > 0 then 'partially_paid'::public.invoice_status
            else status
          end,
          settled_at = now(),
          updated_at = now()
      where id = v_line.id;
      v_avail := v_avail - v_paid;
    end loop;

    perform set_config('chrono.settling', 'off', true);
  end if;
end;
$$;

-- public.enforce_time_entry_month_net_non_negative (from 20260804000000_time_entry_corrections.sql)
create or replace function public.enforce_time_entry_month_net_non_negative()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_project uuid;
  v_month date;
  v_others integer;
  v_self integer;
begin
  if tg_op = 'DELETE' then
    v_user := old.user_id;
    v_project := old.project_id;
    v_month := date_trunc('month', old.entry_date)::date;
    select coalesce(sum(te.duration_minutes), 0)
      into v_others
    from public.time_entries te
    where te.user_id = v_user
      and te.project_id = v_project
      and te.deleted = false
      and date_trunc('month', te.entry_date)::date = v_month
      and te.id is distinct from old.id;
    if v_others < 0 then
      raise exception
        'time-net-negative-delete:%',
        v_others;
    end if;
    return old;
  end if;

  v_user := new.user_id;
  v_project := new.project_id;
  v_month := date_trunc('month', new.entry_date)::date;

  -- Soft-delete: exclude this row from the net (same as hard delete).
  if coalesce(new.deleted, false) then
    select coalesce(sum(te.duration_minutes), 0)
      into v_others
    from public.time_entries te
    where te.user_id = v_user
      and te.project_id = v_project
      and te.deleted = false
      and date_trunc('month', te.entry_date)::date = v_month
      and te.id is distinct from new.id;
    if v_others < 0 then
      raise exception
        'time-net-negative-remove:%',
        v_others;
    end if;
    return new;
  end if;

  v_self := new.duration_minutes;

  select coalesce(sum(te.duration_minutes), 0)
    into v_others
  from public.time_entries te
  where te.user_id = v_user
    and te.project_id = v_project
    and te.deleted = false
    and date_trunc('month', te.entry_date)::date = v_month
    and te.id is distinct from new.id;

  if v_others + v_self < 0 then
    raise exception
      'time-net-negative-correction:%:%',
      v_others, v_self;
  end if;

  return new;
end;
$$;

-- public.enforce_revenue_entry_month_net_non_negative (from 20260806000000_revenue_entry_corrections.sql)
create or replace function public.enforce_revenue_entry_month_net_non_negative()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
  v_month date;
  v_others bigint;
  v_self bigint;
begin
  if tg_op = 'DELETE' then
    v_project := old.project_id;
    v_month := old.period_month;
    select coalesce(sum(re.amount_cents), 0)
      into v_others
    from public.revenue_entries re
    where re.project_id = v_project
      and re.period_month = v_month
      and re.deleted = false
      and re.id is distinct from old.id;
    if v_others < 0 then
      raise exception
        'revenue-net-negative-delete:%',
        v_others;
    end if;
    return old;
  end if;

  v_project := new.project_id;
  v_month := new.period_month;

  if coalesce(new.deleted, false) then
    select coalesce(sum(re.amount_cents), 0)
      into v_others
    from public.revenue_entries re
    where re.project_id = v_project
      and re.period_month = v_month
      and re.deleted = false
      and re.id is distinct from new.id;
    if v_others < 0 then
      raise exception
        'revenue-net-negative-remove:%',
        v_others;
    end if;
    return new;
  end if;

  v_self := new.amount_cents;
  select coalesce(sum(re.amount_cents), 0)
    into v_others
  from public.revenue_entries re
  where re.project_id = v_project
    and re.period_month = v_month
    and re.deleted = false
    and re.id is distinct from new.id;

  if v_others + v_self < 0 then
    raise exception
      'revenue-net-negative-correction:%:%',
      v_others, v_self;
  end if;

  return new;
end;
$$;

-- public.correct_revenue_source (from 20260806000000_revenue_entry_corrections.sql)
create or replace function public.correct_revenue_source(
  p_source_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_src public.revenue_sources%rowtype;
  v_period date;
  v_net bigint;
  v_paid_at timestamptz;
  v_ends date;
begin
  select * into v_src
  from public.revenue_sources
  where id = p_source_id and deleted = false;

  if not found then
    raise exception 'revenue-source-not-found';
  end if;

  if not public.is_company_manager(v_src.company_id) then
    raise exception 'revenue-correct-forbidden';
  end if;

  -- Keep history: deactivate, do not soft-delete the source.
  v_ends := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  update public.revenue_sources
    set active = false,
        ends_on = coalesce(ends_on, v_ends),
        updated_at = now()
  where id = p_source_id;

  for v_period, v_net in
    select re.period_month, coalesce(sum(re.amount_cents), 0)
    from public.revenue_entries re
    where re.revenue_source_id = p_source_id
      and re.deleted = false
    group by re.period_month
    having coalesce(sum(re.amount_cents), 0) > 0
  loop
    -- Reset each iteration: PL/pgSQL keeps the prior INTO value when SELECT
    -- finds no row (would otherwise leak paid_at across periods).
    v_paid_at := null;
    -- Mirror paid status from the positive auto entry when present.
    select re.paid_at into v_paid_at
    from public.revenue_entries re
    where re.revenue_source_id = p_source_id
      and re.period_month = v_period
      and re.deleted = false
      and re.auto_generated = true
      and re.amount_cents > 0
    order by re.created_at desc
    limit 1;

    insert into public.revenue_entries (
      project_id, company_id, revenue_source_id, type, period_month,
      amount_cents, auto_generated, notes, paid_at
    ) values (
      v_src.project_id, v_src.company_id, v_src.id, v_src.type, v_period,
      -v_net, false, 'Correction: revenue source deactivated', v_paid_at
    );
  end loop;

  -- Stop future recognition for the current month as well.
  perform public.recognize_project_revenue(v_src.project_id, current_date);
end;
$$;

-- public.enforce_vacation_allowance (from 20260809000000_rem_review_fixes.sql)
create or replace function public.enforce_vacation_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
  v_hpd numeric;
  v_year integer;
  v_used numeric;
  v_adding numeric;
  v_period date;
  v_cap_minutes numeric;
  v_work_minutes numeric;
  v_leave_minutes numeric;
  v_new_minutes numeric;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;
  if new.kind is distinct from 'vacation' then
    return new;
  end if;

  select max_vacation_days_per_year into v_max
  from public.companies where id = new.company_id;
  -- null = unlimited (documented company policy)
  if v_max is not null then
    v_hpd := public.company_hours_per_day(new.company_id);
    v_year := extract(year from new.off_date)::integer;

    select coalesce(sum(
      case
        when t.duration_minutes is null then 1
        else t.duration_minutes::numeric / nullif(v_hpd * 60, 0)
      end
    ), 0) into v_used
    from public.time_off t
    where t.company_id = new.company_id
      and t.user_id = new.user_id
      and t.kind = 'vacation'
      and extract(year from t.off_date) = v_year
      and t.id is distinct from new.id;

    v_adding := case
      when new.duration_minutes is null then 1
      else new.duration_minutes::numeric / nullif(v_hpd * 60, 0)
    end;

    if v_used + v_adding > v_max + 1e-9 then
      raise exception 'vacation-allowance-exceeded:%', v_max;
    end if;
  end if;

  -- Monthly capacity: work + leave ≤ 22 × company hours/day
  v_hpd := public.company_hours_per_day(new.company_id);
  v_cap_minutes := 22 * v_hpd * 60;
  v_period := date_trunc('month', new.off_date)::date;
  v_new_minutes := case
    when new.duration_minutes is null then v_hpd * 60
    else greatest(0, new.duration_minutes)
  end;

  select coalesce(sum(greatest(0, te.duration_minutes)), 0) into v_work_minutes
  from public.time_entries te
  where te.company_id = new.company_id
    and te.user_id = new.user_id
    and te.deleted = false
    and te.status is distinct from 'rejected'
    and date_trunc('month', te.entry_date)::date = v_period;

  select coalesce(sum(
    case
      when t.duration_minutes is null then v_hpd * 60
      else greatest(0, t.duration_minutes)
    end
  ), 0) into v_leave_minutes
  from public.time_off t
  where t.company_id = new.company_id
    and t.user_id = new.user_id
    and t.kind = 'vacation'
    and date_trunc('month', t.off_date)::date = v_period
    and t.id is distinct from new.id;

  if v_work_minutes + v_leave_minutes + v_new_minutes > v_cap_minutes + 1e-9 then
    raise exception 'capacity-exceeded:%', v_hpd;
  end if;

  return new;
end;
$$;

-- public.enforce_monthly_capacity (from 20260809000000_rem_review_fixes.sql)
create or replace function public.enforce_monthly_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hpd numeric;
  v_cap_minutes numeric;
  v_period date;
  v_work_minutes numeric;
  v_leave_minutes numeric;
  v_new_minutes numeric;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;
  if coalesce(new.deleted, false) or new.status = 'rejected' then
    return new;
  end if;

  v_hpd := public.company_hours_per_day(new.company_id);
  v_cap_minutes := 22 * v_hpd * 60;
  v_period := date_trunc('month', new.entry_date)::date;
  v_new_minutes := greatest(0, coalesce(new.duration_minutes, 0));

  select coalesce(sum(greatest(0, te.duration_minutes)), 0) into v_work_minutes
  from public.time_entries te
  where te.company_id = new.company_id
    and te.user_id = new.user_id
    and te.deleted = false
    and te.status is distinct from 'rejected'
    and date_trunc('month', te.entry_date)::date = v_period
    and te.id is distinct from new.id;

  select coalesce(sum(
    case
      when t.duration_minutes is null then v_hpd * 60
      else greatest(0, t.duration_minutes)
    end
  ), 0) into v_leave_minutes
  from public.time_off t
  where t.company_id = new.company_id
    and t.user_id = new.user_id
    and t.kind = 'vacation'
    and date_trunc('month', t.off_date)::date = v_period;

  if v_work_minutes + v_leave_minutes + v_new_minutes > v_cap_minutes + 1e-9 then
    raise exception 'capacity-exceeded:%', v_hpd;
  end if;
  return new;
end;
$$;

-- public.enforce_working_weekdays_shape (from 20260808000000_canonical_remuneration.sql)
create or replace function public.enforce_working_weekdays_shape()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer[];
  v_d integer;
begin
  v_days := case
    when tg_table_name = 'companies' then new.working_weekdays
    else new.working_weekdays
  end;
  if v_days is null then
    return new;
  end if;
  if coalesce(cardinality(v_days), 0) = 0 then
    raise exception 'working-weekdays-empty';
  end if;
  foreach v_d in array v_days loop
    if v_d < 1 or v_d > 7 then
      raise exception 'working-weekdays-out-of-range';
    end if;
  end loop;
  if (select count(distinct x) from unnest(v_days) x) <> cardinality(v_days) then
    raise exception 'working-weekdays-duplicate';
  end if;
  return new;
end;
$$;

-- public.enforce_product_pool_project (from 20260808000000_canonical_remuneration.sql)
create or replace function public.enforce_product_pool_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_policy public.rem_policy;
  v_deleted boolean;
begin
  if new.product_pool_project_id is null then
    return new;
  end if;
  select company_id, rem_policy, deleted
    into v_company, v_policy, v_deleted
  from public.projects where id = new.product_pool_project_id;
  if not found or v_deleted or v_company is distinct from new.id or v_policy is distinct from 'product_pool' then
    raise exception 'product-pool-project-invalid';
  end if;
  return new;
end;
$$;
