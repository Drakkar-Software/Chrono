-- ============================================================================
-- Manual invoice override for time-based revenue sources
--
-- A time_based source normally derives its monthly amount from approved
-- billable time entries × client TJM. Some projects aren't tracked in Chrono
-- at all (freelancer logs time elsewhere) — for those, the manager needs to
-- key in "I invoiced the client N days this month" directly. `content` can
-- now carry `manual_amount_cents` (days × TJM, computed client-side); when
-- present, recognition uses it as-is instead of summing time entries.
-- self_billing is unaffected — it stays derived from logged time + markup.
-- ============================================================================

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
      -- Manual invoice override: skip the time-entry lookup entirely.
      v_amount := coalesce((v_src.content ->> 'manual_amount_cents')::bigint, 0);
    else
      -- time_based (no override) / self_billing: bill approved billable time at the client day rate.
      -- Sargable range (not date_trunc(...) = X) so time_entries_project_date_idx applies.
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

    -- Never recognize negative revenue (e.g. a bad markup_pct < -100 or a negative
    -- configured amount); floor at 0.
    if v_amount < 0 then v_amount := 0; end if;

    insert into public.revenue_entries
      (project_id, company_id, revenue_source_id, type, period_month, amount_cents, auto_generated)
    values
      (p_project_id, v_company_id, v_src.id, v_src.type, v_period, v_amount, true)
    on conflict (revenue_source_id, period_month)
      do update set amount_cents = excluded.amount_cents, updated_at = now();
  end loop;
end;
$$;
