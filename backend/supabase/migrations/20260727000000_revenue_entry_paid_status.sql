-- ============================================================================
-- Revenue entries: paid / due-by-client status
--
-- Until now, recognized revenue (revenue_entries) counted toward a project's
-- funding pool the instant it was recognized — regardless of whether the
-- client had actually paid the invoice for it. That let the pool (and
-- settlement) get ahead of real cash. This adds `paid_at` (null = due by
-- client, the default for every new AND existing row — no backfill) and
-- gates the funding pool in `settle_project_month` on paid entries only.
-- Recognition (`recognize_project_revenue`) is untouched: its upsert never
-- writes `paid_at`, so re-recognizing an already-paid month's amount (e.g.
-- more time gets approved) does not reset its paid status.
-- ============================================================================

alter table public.revenue_entries
  add column paid_at timestamptz null;

comment on column public.revenue_entries.paid_at is
  'When the client actually paid this recognized amount. Null = due by client (default). Only paid entries count toward the funding pool (see settle_project_month).';

-- Mark one or more revenue entries paid/due. A manager only, scoped to their
-- own company's entries. Powers both the single-row toggle and a bulk
-- "mark all due paid" action (pass every due entry's id).
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
    raise exception 'No matching revenue entries';
  end if;

  if (select count(distinct company_id) from public.revenue_entries where id = any(p_entry_ids) and deleted = false) > 1 then
    raise exception 'Revenue entries must belong to a single company';
  end if;

  if not public.is_company_manager(v_company_id) then
    raise exception 'Only a manager can mark revenue entries paid';
  end if;

  update public.revenue_entries
  set paid_at = case when p_paid then now() else null end,
      updated_at = now()
  where id = any(p_entry_ids)
    and company_id = v_company_id
    and deleted = false;
end;
$$;

grant execute on function public.mark_revenue_entries_paid(uuid[], boolean) to authenticated;

-- Redefine settle_project_month to gate the funding pool on paid revenue only
-- (`and paid_at is not null`). Body otherwise unchanged from
-- 20260722000000_project_fixed_costs.sql.
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

    v_cum_fixed := public.project_fixed_cost_cumulative(p_project_id, v_m);

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
