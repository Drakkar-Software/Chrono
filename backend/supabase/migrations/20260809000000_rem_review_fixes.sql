-- Review fixes for canonical rem (post 20260808000000).
-- Re-applies corrected triggers + compute/settle for DBs that already ran pre-review 080.

revoke all on function public.company_hours_per_day(uuid) from public;
revoke all on function public.company_hours_per_day(uuid) from anon, authenticated;


create or replace function public._chrono_restore_jungle_period(
  p_company_id uuid,
  p_period date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.jungle_tjm_queue_entries e
  set remaining_cents = remaining_cents + s.amount_cents, updated_at = now()
  from public.jungle_tjm_queue_settlements s
  where s.queue_entry_id = e.id
    and s.company_id = p_company_id
    and s.period_month = p_period
    and e.deleted = false;

  delete from public.jungle_tjm_queue_settlements
  where company_id = p_company_id and period_month = p_period;

  update public.jungle_tjm_queue_entries
    set deleted = true, updated_at = now()
  where company_id = p_company_id and period_month = p_period and deleted = false;
end;
$$;

revoke all on function public._chrono_restore_jungle_period(uuid, date) from public;
revoke all on function public._chrono_restore_jungle_period(uuid, date) from anon, authenticated;

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
      raise exception 'Vacation allowance exceeded (% days/year)', v_max;
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
    raise exception 'Monthly capacity exceeded (22 × %h)', v_hpd;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_vacation_allowance_trigger on public.time_off;
create trigger enforce_vacation_allowance_trigger
  before insert or update on public.time_off
  for each row execute function public.enforce_vacation_allowance();

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
    raise exception 'Monthly capacity exceeded (22 × %h)', v_hpd;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_monthly_capacity_trigger on public.time_entries;
create trigger enforce_monthly_capacity_trigger
  before insert or update on public.time_entries
  for each row execute function public.enforce_monthly_capacity();



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
    raise exception 'Only a manager can compute rem month';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_company_id::text || v_period::text));

  select company_fee_pct, rem_max_percent / 100.0, default_license_pct,
         coalesce(default_hours_per_day, 8)
    into v_fee_pct, v_max_pct, v_license_pct, v_hpd_default
  from public.companies where id = p_company_id and deleted = false;
  if not found then
    raise exception 'Company not found';
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
    raise exception 'Rem month is locked';
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
        raise exception 'License distribution requires exactly two rem_license_recipient members (found %)', v_partner_count;
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
      raise exception 'License distribution requires exactly two rem_license_recipient members (found %)', v_partner_count;
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

grant execute on function public.compute_rem_month(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Settlement: product_pool invoices only via designated pool project
-- ---------------------------------------------------------------------------

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
    raise exception 'Project not found';
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

grant execute on function public.settle_project_month_with_rem(uuid, date) to authenticated;
