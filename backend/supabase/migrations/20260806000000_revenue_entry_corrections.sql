-- Revenue-entry corrections: signed amount_cents (≠ 0), keep source history.
-- Removing a source deactivates it and inserts offsetting negative entries.
-- Recognition only upserts auto_generated rows; corrections are never rewritten.

-- 1) Allow signed non-zero amounts
-- Hosted DBs may already have zero-cent rows (invalid under corrections).
-- Remove them before adding the check so db push is not blocked.
delete from public.revenue_entries
where amount_cents = 0;

alter table public.revenue_entries
  drop constraint if exists revenue_entries_amount_cents_check;

alter table public.revenue_entries
  add constraint revenue_entries_amount_cents_check
  check (amount_cents <> 0);

comment on column public.revenue_entries.amount_cents is
  'Recognized cents; may be negative for an explicit correction that offsets prior revenue.';

-- 2) Replace one-row-per-source-month unique with partial unique on auto rows only
alter table public.revenue_entries
  drop constraint if exists revenue_entries_revenue_source_id_period_month_key;

create unique index if not exists revenue_entries_source_period_auto_uidx
  on public.revenue_entries (revenue_source_id, period_month)
  where auto_generated = true and deleted = false;

-- 3) Net floor: project × period_month sum ≥ 0
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
        'Deleting this revenue entry would make net revenue negative for this project month (remaining %)',
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
        'Removing this revenue entry would make net revenue negative for this project month (remaining %)',
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
      'Correction would make net revenue negative for this project month (others %, self %)',
      v_others, v_self;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_revenue_entry_month_net_non_negative_trigger on public.revenue_entries;
create trigger enforce_revenue_entry_month_net_non_negative_trigger
  before insert or update or delete on public.revenue_entries
  for each row execute function public.enforce_revenue_entry_month_net_non_negative();

-- 4) Recognize: auto rows only + restore retirement of orphaned auto entries
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

grant execute on function public.recognize_project_revenue(uuid, date) to authenticated;

-- 5) Correct / remove a source: deactivate + insert offsetting entries
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
    raise exception 'Revenue source not found';
  end if;

  if not public.is_company_manager(v_src.company_id) then
    raise exception 'Only a manager can correct revenue';
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

grant execute on function public.correct_revenue_source(uuid) to authenticated;

-- 6) Clamp referral earnings when month revenue is reduced by corrections
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
