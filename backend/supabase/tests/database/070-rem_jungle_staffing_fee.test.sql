-- Jungle FIFO + global company fee on staffing/jungle paid revenue.
begin;
select plan(8);

create temporary table jung_ctx (
  admin uuid,
  g uuid,
  p uuid,
  company uuid,
  jungle uuid,
  staff uuid,
  period date
);
grant all on table jung_ctx to authenticated, anon;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_g uuid := gen_random_uuid();
  v_p uuid := gen_random_uuid();
  v_company uuid;
  v_j uuid;
  v_s uuid;
  v_period date := '2026-09-01';
  v_src uuid;
begin
  perform tests.create_auth_user(v_admin, 'jung-admin@example.com');
  perform tests.create_auth_user(v_g, 'jung-g@example.com');
  perform tests.create_auth_user(v_p, 'jung-p@example.com');
  v_company := tests.make_company(v_admin, 'jung-' || substr(v_admin::text, 1, 8));
  perform tests.add_member(v_company, v_g, 'freelancer');
  perform tests.add_member(v_company, v_p, 'freelancer');

  update public.companies
  set company_fee_pct = 5, default_hours_per_day = 8
  where id = v_company;

  insert into public.projects (
    company_id, name, rem_policy, hours_per_day, jungle_fictitious_tjm_cents, created_by
  ) values (v_company, 'Jungle', 'jungle', 8, 100000, v_admin)
  returning id into v_j;

  insert into public.projects (
    company_id, name, rem_policy, hours_per_day, default_tjm_cents, created_by
  ) values (v_company, 'Staff', 'staffing', 8, 100000, v_admin)
  returning id into v_s;

  insert into public.time_entries (
    company_id, project_id, user_id, entry_date, duration_minutes, status
  ) values
    (v_company, v_j, v_g, v_period + 1, 8 * 60, 'approved'),
    (v_company, v_j, v_p, v_period + 2, 8 * 60, 'approved');

  insert into public.revenue_sources (company_id, project_id, type, name, created_by)
  values (v_company, v_j, 'recurring', 'Jungle sales', v_admin)
  returning id into v_src;

  insert into public.revenue_entries (
    company_id, project_id, revenue_source_id, type, period_month, amount_cents, paid_at, auto_generated
  ) values (v_company, v_j, v_src, 'recurring', v_period, 150000, now(), false);

  insert into public.time_entries (
    company_id, project_id, user_id, entry_date, duration_minutes, status
  ) values (v_company, v_s, v_g, v_period + 3, 8 * 60, 'approved');

  insert into public.revenue_sources (company_id, project_id, type, name, created_by)
  values (v_company, v_s, 'recurring', 'Staff client', v_admin)
  returning id into v_src;

  insert into public.revenue_entries (
    company_id, project_id, revenue_source_id, type, period_month, amount_cents, paid_at, auto_generated
  ) values (v_company, v_s, v_src, 'recurring', v_period, 200000, now(), false);

  insert into jung_ctx values (v_admin, v_g, v_p, v_company, v_j, v_s, v_period);
end $$;

select tests.authenticate_as((select admin from jung_ctx));
select lives_ok(
  $$select public.compute_rem_month((select company from jung_ctx), (select period from jung_ctx))$$,
  'jungle+staffing compute succeeds'
);

select is(
  (select coalesce(sum(amount_cents), 0)::text from public.rem_lines
   where company_id = (select company from jung_ctx)
     and project_id = (select jungle from jung_ctx)
     and bucket = 'company_fee'),
  '7500',
  'jungle fee = 5% of 150000'
);

select is(
  (select coalesce(sum(amount_cents), 0)::text from public.rem_lines
   where company_id = (select company from jung_ctx)
     and project_id = (select jungle from jung_ctx)
     and bucket = 'jungle_dequeue'),
  '142500',
  'jungle dequeue uses post-fee 142500'
);

select is(
  (select coalesce(sum(amount_cents), 0)::text from public.rem_lines
   where company_id = (select company from jung_ctx)
     and project_id = (select staff from jung_ctx)
     and bucket = 'company_fee'),
  '10000',
  'staffing fee = 5% of paid 200000'
);

select is(
  (select count(*)::text from public.jungle_tjm_queue_entries
   where project_id = (select jungle from jung_ctx) and deleted = false),
  '2',
  'two jungle queue entries enqueued'
);

select lives_ok(
  $$select public.compute_rem_month((select company from jung_ctx), (select period from jung_ctx))$$,
  'jungle recompute idempotent'
);

select is(
  (select coalesce(sum(remaining_cents), 0)::text from public.jungle_tjm_queue_entries
   where project_id = (select jungle from jung_ctx) and deleted = false),
  '57500',
  'remaining queue = queued − dequeued'
);

select is(
  (select amount_cents::text from public.company_fee_reserve_ledger
   where company_id = (select company from jung_ctx)
     and period_month = (select period from jung_ctx)),
  '17500',
  'fee reserve includes jungle + staffing fees'
);

select * from finish();
rollback;
