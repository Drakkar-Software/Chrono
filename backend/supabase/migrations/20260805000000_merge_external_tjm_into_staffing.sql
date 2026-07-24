-- Merge external_tjm into staffing: days × TJM, with referral carve-out when
-- project_referrals exist. Classic FIFO settle remains the payable path.
-- Enum value external_tjm is left in place (Postgres cannot easily drop enum
-- labels) but projects are migrated and compute treats both as staffing.

update public.projects
  set rem_policy = 'staffing', updated_at = now()
  where rem_policy = 'external_tjm';

-- Historical rem lines: keep amounts, normalize bucket name.
update public.rem_lines
  set bucket = 'staffing_tjm'
  where bucket = 'external_contract';

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
  v_proj record;
  v_direct bigint;
  v_maint bigint;
  v_costs bigint;
  v_after_costs bigint;
  v_fee bigint;
  v_net bigint;
  v_partner record;
  v_total_weight numeric;
  v_share numeric;
  v_amount bigint;
  v_rev bigint;
  v_license bigint;
  v_referral bigint;
  v_pool bigint;
  v_ref_pct numeric;
  v_src_license numeric;
  v_hpd numeric;
  v_tjm integer;
  v_minutes integer;
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
begin
  if not public.is_company_manager(p_company_id) then
    raise exception 'Only a manager can compute rem month';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_company_id::text || v_period::text));

  select company_fee_pct, rem_max_percent / 100.0, default_license_pct
    into v_fee_pct, v_max_pct, v_license_pct
  from public.companies where id = p_company_id and deleted = false;
  if not found then
    raise exception 'Company not found';
  end if;
  v_fee_pct := coalesce(v_fee_pct, 0);
  v_max_pct := coalesce(v_max_pct, 1);
  v_license_pct := coalesce(v_license_pct, 0);

  insert into public.rem_months (company_id, period_month, status)
  values (p_company_id, v_period, 'draft')
  on conflict (company_id, period_month) do update
    set updated_at = now()
  returning id, status into v_month_id, v_status;

  if v_status = 'locked' then
    raise exception 'Rem month is locked';
  end if;

  delete from public.rem_lines where month_id = v_month_id;

  -- ---- product_pool projects: aggregate direct + maintenance ----
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

  select coalesce(sum(
    case when te.status = 'approved' then te.duration_minutes else 0 end
  ), 0)::numeric into v_total_weight
  from public.time_entries te
  join public.projects p on p.id = te.project_id
  join public.company_members cm on cm.company_id = p_company_id and cm.user_id = te.user_id and cm.deleted = false
  where te.company_id = p_company_id
    and te.deleted = false
    and p.rem_policy = 'product_pool'
    and date_trunc('month', te.entry_date)::date = v_period
    and cm.rem_partner = true;

  -- Vacation → minutes (full day uses default hours)
  select v_total_weight + coalesce(sum(
    case
      when t.duration_minutes is null then
        coalesce(
          (select default_hours_per_day from public.companies where id = p_company_id),
          7
        ) * 60
      else t.duration_minutes
    end
  ), 0)
  into v_total_weight
  from public.time_off t
  join public.company_members cm
    on cm.company_id = p_company_id and cm.user_id = t.user_id and cm.deleted = false
  where t.company_id = p_company_id
    and t.kind = 'vacation'
    and cm.rem_partner = true
    and date_trunc('month', t.off_date)::date = v_period;

  if v_net > 0 then
    if v_total_weight <= 0 then
      select count(*) into v_partner_count
      from public.company_members
      where company_id = p_company_id and deleted = false and rem_partner = true;
      if v_partner_count > 0 then
        v_ord := 0;
        for v_partner in
          select user_id from public.company_members
          where company_id = p_company_id and deleted = false and rem_partner = true
          order by user_id
        loop
          select amount_cents into v_amount
          from public.rem_equal_split_amounts(v_net, v_partner_count)
          where ord = v_ord;
          insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
          values (v_month_id, p_company_id, v_partner.user_id, null, 'product_pool', coalesce(v_amount, 0),
                  jsonb_build_object('equal_split', true, 'net', v_net));
          v_ord := v_ord + 1;
        end loop;
      end if;
    else
      create temporary table if not exists _rem_shares (
        user_id uuid primary key,
        raw numeric not null default 0,
        max_f numeric not null,
        share numeric not null default 0
      ) on commit drop;
      truncate _rem_shares;

      insert into _rem_shares (user_id, raw, max_f, share)
      select w.user_id, sum(w.w), max(w.max_f), 0
      from (
        select te.user_id,
               greatest(0, sum(te.duration_minutes))::numeric as w,
               least(coalesce(cm.rem_max_percent, v_max_pct * 100) / 100.0, v_max_pct) as max_f
        from public.time_entries te
        join public.projects p on p.id = te.project_id
        join public.company_members cm
          on cm.company_id = p_company_id and cm.user_id = te.user_id and cm.deleted = false
        where te.company_id = p_company_id
          and te.deleted = false and te.status = 'approved'
          and p.rem_policy = 'product_pool'
          and date_trunc('month', te.entry_date)::date = v_period
          and cm.rem_partner = true
        group by te.user_id, cm.rem_max_percent
        union all
        select t.user_id,
               sum(case
                 when t.duration_minutes is null then coalesce(
                   (select default_hours_per_day from public.companies where id = p_company_id), 7
                 ) * 60
                 else t.duration_minutes end)::numeric,
               least(coalesce(cm.rem_max_percent, v_max_pct * 100) / 100.0, v_max_pct)
        from public.time_off t
        join public.company_members cm
          on cm.company_id = p_company_id and cm.user_id = t.user_id and cm.deleted = false
        where t.company_id = p_company_id and t.kind = 'vacation'
          and cm.rem_partner = true
          and date_trunc('month', t.off_date)::date = v_period
        group by t.user_id, cm.rem_max_percent
      ) w
      group by w.user_id;

      select coalesce(sum(raw), 0) into v_sum_raw from _rem_shares;
      if v_sum_raw > 0 then
        update _rem_shares set raw = raw / v_sum_raw, share = raw / v_sum_raw;
      end if;

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

      for v_partner in select user_id, share from _rem_shares loop
        v_amount := public.rem_round_cents(v_net * v_partner.share);
        if v_amount <> 0 then
          insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
          values (v_month_id, p_company_id, v_partner.user_id, null, 'product_pool', v_amount,
                  jsonb_build_object('share', v_partner.share, 'net', v_net));
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

    -- Time split of pool
    -- Floor per-user weights at 0 so corrections cannot inflate other partners' shares.
    select coalesce(sum(w), 0)::numeric into v_total_weight
    from (
      select greatest(0, sum(duration_minutes))::numeric as w
      from public.time_entries
      where project_id = v_proj.id and deleted = false and status = 'approved'
        and date_trunc('month', entry_date)::date = v_period
      group by user_id
    ) weights;

    if v_pool > 0 and v_total_weight > 0 then
      for v_partner in
        select user_id, greatest(0, sum(duration_minutes))::numeric as w
        from public.time_entries
        where project_id = v_proj.id and deleted = false and status = 'approved'
          and date_trunc('month', entry_date)::date = v_period
        group by user_id
        having sum(duration_minutes) > 0
      loop
        v_amount := public.rem_round_cents(v_pool * (v_partner.w / v_total_weight));
        insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
        values (v_month_id, p_company_id, v_partner.user_id, v_proj.id, 'product_service', v_amount,
                jsonb_build_object('pool', v_pool));
      end loop;
    end if;

    -- License 1/N among rem_partners (largest remainder)
    select count(*) into v_partner_count
    from public.company_members
    where company_id = p_company_id and deleted = false and rem_partner = true;
    if v_license > 0 and v_partner_count > 0 then
      v_ord := 0;
      for v_partner in
        select user_id from public.company_members
        where company_id = p_company_id and deleted = false and rem_partner = true
        order by user_id
      loop
        select amount_cents into v_license_each
        from public.rem_equal_split_amounts(v_license, v_partner_count)
        where ord = v_ord;
        insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
        values (v_month_id, p_company_id, v_partner.user_id, v_proj.id, 'license', coalesce(v_license_each, 0),
                jsonb_build_object('license_total', v_license));
        v_ord := v_ord + 1;
      end loop;
    end if;

    -- Referral to referrers
    if v_referral > 0 then
      for v_partner in
        select user_id, percent from public.project_referrals
        where project_id = v_proj.id and deleted = false
          and (starts_on is null or starts_on <= (v_period + interval '1 month - 1 day')::date)
          and (ends_on is null or ends_on >= v_period)
      loop
        v_amount := public.rem_round_cents(v_rev * v_partner.percent / 100.0);
        insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents, meta)
        values (v_month_id, p_company_id, v_partner.user_id, v_proj.id, 'referral', v_amount,
                jsonb_build_object('percent', v_partner.percent));
      end loop;
    end if;
  end loop;

  -- ---- staffing: days × TJM (referral carve-out when apporteurs are set) ----
  -- Former external_tjm projects are migrated to staffing; same spine.
  -- Payables stay on classic FIFO settle; rem lines are the partner ledger.
  -- Referral payables stay on referral_earnings (settle), not rem invoice upsert.
  for v_proj in
    select id, hours_per_day, default_tjm_cents
    from public.projects
    where company_id = p_company_id and deleted = false
      and rem_policy in ('staffing', 'external_tjm')
  loop
    v_hpd := coalesce(v_proj.hours_per_day, 7);
    select coalesce(sum(pr.percent), 0) into v_ref_pct
    from public.project_referrals pr
    where pr.project_id = v_proj.id and pr.deleted = false
      and (pr.starts_on is null or pr.starts_on <= (v_period + interval '1 month - 1 day')::date)
      and (pr.ends_on is null or pr.ends_on >= v_period);

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

  -- ---- jungle: idempotent enqueue for period, then dequeue paid revenue ----
  -- Soft-delete this period's queue rows + settlements so recompute is safe.
  delete from public.jungle_tjm_queue_settlements s
  using public.jungle_tjm_queue_entries e
  where s.queue_entry_id = e.id
    and e.company_id = p_company_id
    and e.period_month = v_period;
  update public.jungle_tjm_queue_entries
    set deleted = true, updated_at = now()
  where company_id = p_company_id and period_month = v_period and deleted = false;

  for v_proj in
    select id, jungle_fictitious_tjm_cents, hours_per_day, company_id
    from public.projects
    where company_id = p_company_id and deleted = false and rem_policy = 'jungle'
  loop
    v_hpd := coalesce(v_proj.hours_per_day, 7);
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

    v_left := v_paid_rev;
    for v_q in
      select * from public.jungle_tjm_queue_entries
      where project_id = v_proj.id and deleted = false and remaining_cents > 0
      order by seq
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

  -- Fee reserve upsert
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
begin
  select company_id, rem_policy into v_company_id, v_policy
  from public.projects where id = p_project_id;
  if v_company_id is null then
    raise exception 'Project not found';
  end if;

  -- Classic staffing settle (recognition + FIFO) — always safe for staffing revenue.
  perform public.settle_project_month(p_project_id, p_period);

  -- Refresh rem ledger (re-raise unless month is locked)
  begin
    v_month_id := public.compute_rem_month(v_company_id, v_period);
  exception
    when raise_exception then
      if SQLERRM like '%locked%' then
        return;
      end if;
      raise;
  end;

  -- Non-staffing: upsert submitted invoices from rem_lines and pay from project pool.
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
        and (project_id = p_project_id or (project_id is null and v_policy = 'product_pool'))
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
        0, 0, 7,
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

    -- Pay rem invoices from this project's paid revenue (simple: mark paid if funded).
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
