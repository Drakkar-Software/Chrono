-- ============================================================================
-- Recurring revenue: a real schedule (frequency + start date)
--
-- Until now a recurring revenue source meant exactly one thing: a flat figure
-- in content.monthly_amount_cents, recognized every month, forever, starting
-- whenever the source happened to be created. revenue_sources.starts_on and
-- ends_on already existed and recognize_project_revenue already filtered on
-- them — the app simply never wrote them.
--
-- A recurring source now carries a schedule in `content`:
--   { "frequency": "daily|weekly|biweekly|monthly|quarterly|yearly",
--     "amount_cents": <what ONE occurrence is worth> }
-- anchored on revenue_sources.starts_on and bounded by revenue_sources.ends_on.
--
-- The schedule is expanded PER MONTH, not below it. revenue_entries.period_month
-- is a hard monthly grain (partial unique index on (revenue_source_id,
-- period_month)) and invoices, rem_months, rem_lines, referral_earnings and
-- company_fee_reserve_ledger all key off it. So a weekly source does not write
-- weekly rows: recognition counts the occurrences landing inside the month and
-- writes that month's single entry. Weekly 500€ from 2026-03-11 recognizes
-- 1500€ in March (the 11th, 18th, 25th) and 2500€ in April (the 1st, 8th, 15th,
-- 22nd, 29th). `daily` counts calendar days — weekends and holidays included.
--
-- LEGACY SOURCES ARE UNTOUCHED. No `frequency` key in content means a
-- pre-frequency source: the flat monthly_amount_cents, once a month, exactly as
-- before. Those rows also have starts_on = null, so nothing about them shifts.
--
-- No column is added to revenue_sources. This migration adds an occurrence
-- helper, swaps the recurring branch of recognize_project_revenue to use it,
-- and adds a range wrapper so a source backdated to a past start date can
-- back-fill every month it missed in one round trip.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- public.recurring_occurrences_in_month
--
-- MIRRORED IN TYPESCRIPT as `occurrencesInMonth`
-- (packages/sdk/src/revenue-source/revenue-source.lib.ts) — change both
-- together, the way project_cost_cumulative mirrors project-cost.lib.ts.
-- ----------------------------------------------------------------------------
create or replace function public.recurring_occurrences_in_month(
  p_frequency text,
  p_starts_on date,
  p_ends_on date,
  p_period date
)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_month_start date := date_trunc('month', p_period)::date;
  v_month_end   date := (date_trunc('month', p_period) + interval '1 month - 1 day')::date;
  v_win_start   date;
  v_win_end     date;
  v_step        integer;
  v_first_k     integer;
  v_last_k      integer;
  v_cycle       integer;
  v_elapsed     integer;
  v_occurrence  date;
begin
  -- A frequency with no anchor cannot be expanded. Callers treat 0 as "this
  -- helper does not apply" and fall back to the flat monthly reading.
  if p_frequency is null or p_starts_on is null then
    return 0;
  end if;

  -- Intersect the schedule's own window with the month.
  v_win_start := greatest(p_starts_on, v_month_start);
  v_win_end   := least(coalesce(p_ends_on, v_month_end), v_month_end);
  if v_win_start > v_win_end then
    return 0;
  end if;

  if p_frequency = 'daily' then
    return (v_win_end - v_win_start) + 1;
  end if;

  if p_frequency in ('weekly', 'biweekly') then
    v_step := case p_frequency when 'weekly' then 7 else 14 end;
    -- Occurrences are starts_on + step*k; count the k landing in the window.
    v_first_k := greatest(0, ceil((v_win_start - p_starts_on)::numeric / v_step)::integer);
    v_last_k  := floor((v_win_end - p_starts_on)::numeric / v_step)::integer;
    return greatest(0, v_last_k - v_first_k + 1);
  end if;

  v_cycle := case p_frequency
               when 'monthly'   then 1
               when 'quarterly' then 3
               when 'yearly'    then 12
               else 1
             end;
  v_elapsed :=
      (extract(year from v_month_start)::integer - extract(year from p_starts_on)::integer) * 12
    + (extract(month from v_month_start)::integer - extract(month from p_starts_on)::integer);
  if v_elapsed < 0 or v_elapsed % v_cycle <> 0 then
    return 0;
  end if;

  -- Anchor on the start day, clamped to this month's length: a 31st anchor
  -- lands on Feb 28 (29 in a leap year), same clamp as holidayDatesForYear.
  v_occurrence := v_month_start
    + least(
        extract(day from p_starts_on)::integer,
        extract(day from v_month_end)::integer
      ) - 1;

  if v_occurrence >= v_win_start and v_occurrence <= v_win_end then
    return 1;
  end if;
  return 0;
end;
$$;

grant execute on function public.recurring_occurrences_in_month(text, date, date, date) to authenticated;

-- ----------------------------------------------------------------------------
-- public.recognize_project_revenue
--
-- Unchanged from 20260813000000_error_message_slugs.sql except the recurring
-- branch, which now expands the schedule instead of reading a flat monthly
-- figure. An off-cycle month yields 0 occurrences -> v_amount = 0 -> the
-- existing "zero means retire any auto row" branch below fires, so a quarterly
-- source correctly writes nothing in its two idle months.
-- ----------------------------------------------------------------------------
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
  v_freq text;
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
      v_freq := v_src.content ->> 'frequency';
      if v_freq is null then
        -- Legacy source: flat monthly figure, no schedule to expand.
        v_amount := coalesce((v_src.content ->> 'monthly_amount_cents')::bigint, 0);
      elsif v_src.starts_on is null then
        -- A frequency with no anchor cannot be expanded. The form always writes
        -- starts_on alongside a frequency, so this only guards hand-edited or
        -- imported rows; pay one occurrence a month rather than silently paying
        -- zero. Mirrors the same guard in `recurringRevenue`.
        v_amount := coalesce((v_src.content ->> 'amount_cents')::bigint, 0);
      else
        v_amount := coalesce((v_src.content ->> 'amount_cents')::bigint, 0)
          * public.recurring_occurrences_in_month(
              v_freq, v_src.starts_on, v_src.ends_on, v_period
            );
      end if;
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

-- ----------------------------------------------------------------------------
-- public.recognize_project_revenue_range
--
-- Recognize every month from p_from to p_to inclusive (both snapped to their
-- first day). A source backdated to a past start date has to fill in the months
-- it missed: recognize_project_revenue only ever handles the ONE month it is
-- given, so without this the client would fire N sequential RPCs. One call,
-- one transaction instead.
--
-- The manager check is inherited from recognize_project_revenue, which raises
-- revenue-recognize-forbidden on the first month.
-- ----------------------------------------------------------------------------
create or replace function public.recognize_project_revenue_range(
  p_project_id uuid,
  p_from date,
  p_to date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from   date := date_trunc('month', p_from)::date;
  v_to     date := date_trunc('month', p_to)::date;
  v_months integer;
  v_month  date;
begin
  if p_from is null or p_to is null then
    raise exception 'revenue-range-invalid';
  end if;

  if v_to < v_from then
    raise exception 'revenue-range-invalid';
  end if;

  v_months :=
      (extract(year from v_to)::integer - extract(year from v_from)::integer) * 12
    + (extract(month from v_to)::integer - extract(month from v_from)::integer) + 1;

  -- Ten years of back-fill is already far past anything a real contract needs;
  -- beyond that the caller has almost certainly mistyped a start date.
  if v_months > 120 then
    raise exception 'revenue-range-too-wide:%', v_months;
  end if;

  v_month := v_from;
  while v_month <= v_to loop
    perform public.recognize_project_revenue(p_project_id, v_month);
    v_month := (v_month + interval '1 month')::date;
  end loop;
end;
$$;

grant execute on function public.recognize_project_revenue_range(uuid, date, date) to authenticated;
