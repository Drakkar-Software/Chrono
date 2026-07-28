-- Canonical rem compute: product pool / service golden examples + fee conservation.
begin;
select plan(19);

create temporary table rem_ctx (
  admin uuid,
  g uuid,
  p uuid,
  company uuid,
  pool_project uuid,
  service_project uuid,
  period date
);
grant all on table rem_ctx to authenticated, anon;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_g uuid := gen_random_uuid();
  v_p uuid := gen_random_uuid();
  v_company uuid;
  v_pool uuid;
  v_svc uuid;
  v_period date := '2026-07-01';
  v_src_direct uuid;
  v_src_maint uuid;
  v_src_svc uuid;
begin
  perform tests.create_auth_user(v_admin, 'rem-admin@example.com');
  perform tests.create_auth_user(v_g, 'rem-g@example.com');
  perform tests.create_auth_user(v_p, 'rem-p@example.com');
  v_company := tests.make_company(v_admin, 'rem-co-' || substr(v_admin::text, 1, 8));
  perform tests.add_member(v_company, v_g, 'freelancer');
  perform tests.add_member(v_company, v_p, 'freelancer');

  update public.companies
  set company_fee_pct = 5, rem_max_percent = 75, default_license_pct = 30, default_hours_per_day = 8
  where id = v_company;

  update public.company_members
  set rem_partner = true, rem_license_recipient = true
  where company_id = v_company and user_id in (v_g, v_p);

  insert into public.projects (company_id, name, rem_policy, hours_per_day, created_by)
  values (v_company, 'OctoBot pool', 'product_pool', 8, v_admin)
  returning id into v_pool;

  update public.companies set product_pool_project_id = v_pool where id = v_company;

  insert into public.projects (company_id, name, rem_policy, hours_per_day, created_by)
  values (v_company, 'Service', 'product_service', 8, v_admin)
  returning id into v_svc;

  insert into public.revenue_sources (company_id, project_id, type, name, rem_kind, content, created_by)
  values (v_company, v_pool, 'recurring', 'Direct', 'direct_sales', '{}'::jsonb, v_admin)
  returning id into v_src_direct;

  insert into public.revenue_sources (company_id, project_id, type, name, rem_kind, content, created_by)
  values (v_company, v_pool, 'recurring', 'Maint', 'maintenance', '{}'::jsonb, v_admin)
  returning id into v_src_maint;

  insert into public.revenue_sources (company_id, project_id, type, name, rem_kind, content, created_by)
  values (v_company, v_svc, 'recurring', 'Svc', 'product_service', jsonb_build_object('license_pct', 30), v_admin)
  returning id into v_src_svc;

  insert into public.revenue_entries (
    company_id, project_id, revenue_source_id, type, period_month, amount_cents, paid_at, auto_generated
  ) values
    (v_company, v_pool, v_src_direct, 'recurring', v_period, 400000, now(), false),
    (v_company, v_pool, v_src_maint, 'recurring', v_period, 300000, now(), false);

  insert into public.project_costs (
    company_id, project_id, kind, label, amount_cents, active, auto_deduct, period_month, paid_at
  ) values (
    v_company, v_pool, 'one_off', 'Infra', 50000, true, false, v_period, now()
  );

  insert into rem_ctx values (v_admin, v_g, v_p, v_company, v_pool, v_svc, v_period);
end $$;

select tests.authenticate_as((select admin from rem_ctx));

select lives_ok(
  $$select public.compute_rem_month((select company from rem_ctx), (select period from rem_ctx))$$,
  'compute_rem_month succeeds for product pool'
);

select is(
  (select amount_cents::text from public.rem_lines
   where company_id = (select company from rem_ctx)
     and bucket = 'company_fee'
     and (meta->>'source') = 'product_pool'),
  '32500',
  'A1 product pool fee is 32500 on (7000-500)'
);

select is(
  (select sum(amount_cents)::text from public.rem_lines
   where company_id = (select company from rem_ctx)
     and bucket = 'product_pool'),
  '617500',
  'product pool partner lines sum to net 617500'
);

select is(
  (select amount_cents::text from public.rem_lines
   where company_id = (select company from rem_ctx)
     and bucket = 'product_pool'
     and user_id = (select g from rem_ctx)),
  '308750',
  'A1 Guillaume 50% = 308750'
);

select is(
  (select amount_cents::text from public.rem_lines
   where company_id = (select company from rem_ctx)
     and bucket = 'product_pool'
     and user_id = (select p from rem_ctx)),
  '308750',
  'A1 Paul 50% = 308750'
);

reset role;
do $$
declare
  v_company uuid;
  v_admin uuid;
  v_p uuid;
  v_period date;
  v_staff uuid;
begin
  select company, admin, p, period into v_company, v_admin, v_p, v_period from rem_ctx;
  insert into public.projects (company_id, name, rem_policy, hours_per_day, default_tjm_cents, created_by)
  values (v_company, 'Staff', 'staffing', 8, 100000, v_admin)
  returning id into v_staff;

  insert into public.time_entries (
    company_id, project_id, user_id, entry_date, duration_minutes, status
  ) values
    (v_company, v_staff, v_p, v_period + 1, 15 * 8 * 60, 'approved');
end $$;

select tests.authenticate_as((select admin from rem_ctx));
select lives_ok(
  $$select public.compute_rem_month((select company from rem_ctx), (select period from rem_ctx))$$,
  'recompute with residual cap weights'
);

select ok(
  (select amount_cents::text from public.rem_lines
   where company_id = (select company from rem_ctx)
     and bucket = 'product_pool' and user_id = (select g from rem_ctx))
  >
  (select amount_cents::text from public.rem_lines
   where company_id = (select company from rem_ctx)
     and bucket = 'product_pool' and user_id = (select p from rem_ctx)),
  'residual weights favor partner with less staffing'
);

select is(
  (select sum(amount_cents)::text from public.rem_lines
   where company_id = (select company from rem_ctx) and bucket = 'product_pool'),
  '617500',
  'capped/residual product pool still conserves net cents'
);

reset role;
do $$
declare
  v_company uuid;
  v_admin uuid;
  v_g uuid;
  v_p uuid;
  v_svc uuid;
  v_period date;
  v_src uuid;
begin
  select company, admin, g, p, service_project, period
    into v_company, v_admin, v_g, v_p, v_svc, v_period from rem_ctx;
  select id into v_src from public.revenue_sources where project_id = v_svc limit 1;
  insert into public.revenue_entries (
    company_id, project_id, revenue_source_id, type, period_month, amount_cents, paid_at, auto_generated
  ) values (v_company, v_svc, v_src, 'recurring', v_period, 960000, now(), false);

  insert into public.time_entries (
    company_id, project_id, user_id, entry_date, duration_minutes, status
  ) values
    (v_company, v_svc, v_g, v_period + 2, 480, 'approved'),
    (v_company, v_svc, v_p, v_period + 3, 480, 'approved');
end $$;

select tests.authenticate_as((select admin from rem_ctx));
select lives_ok(
  $$select public.compute_rem_month((select company from rem_ctx), (select period from rem_ctx))$$,
  'compute with product service revenue'
);

select is(
  (select amount_cents::text from public.rem_lines
   where company_id = (select company from rem_ctx)
     and project_id = (select service_project from rem_ctx)
     and bucket = 'company_fee'),
  '48000',
  'B1 service fee 48000'
);

select is(
  (select sum(amount_cents)::text from public.rem_lines
   where company_id = (select company from rem_ctx)
     and project_id = (select service_project from rem_ctx)
     and bucket = 'license'),
  '273600',
  'B1 license total 273600'
);

select is(
  (select amount_cents::text from public.rem_lines
   where company_id = (select company from rem_ctx)
     and project_id = (select service_project from rem_ctx)
     and bucket = 'license' and user_id = (select g from rem_ctx)),
  '136800',
  'B1 license 50/50 Guillaume'
);

select is(
  (select amount_cents::text from public.rem_lines
   where company_id = (select company from rem_ctx)
     and project_id = (select service_project from rem_ctx)
     and bucket = 'license' and user_id = (select p from rem_ctx)),
  '136800',
  'B1 license 50/50 Paul'
);

select is(
  (select sum(amount_cents)::text from public.rem_lines
   where company_id = (select company from rem_ctx)
     and project_id = (select service_project from rem_ctx)
     and bucket = 'product_service'),
  '638400',
  'B1 service pool 638400'
);

select is(
  (
    select coalesce(sum(amount_cents),0)::text from public.rem_lines
    where company_id = (select company from rem_ctx)
      and project_id = (select service_project from rem_ctx)
      and bucket in ('company_fee','license','referral','product_service')
  ),
  '960000',
  'B1 service money conservation'
);

reset role;
update public.company_members
set rem_license_recipient = false
where company_id = (select company from rem_ctx) and user_id = (select p from rem_ctx);

select tests.authenticate_as((select admin from rem_ctx));
select throws_ok(
  $$select public.compute_rem_month((select company from rem_ctx), (select period from rem_ctx))$$,
  'P0001',
  'License distribution requires exactly two rem_license_recipient members (found 1)',
  'license requires exactly two recipients'
);

reset role;
update public.company_members
set rem_license_recipient = true
where company_id = (select company from rem_ctx) and user_id = (select p from rem_ctx);

select tests.authenticate_as((select admin from rem_ctx));
select lives_ok(
  $$select public.compute_rem_month((select company from rem_ctx), (select period from rem_ctx))$$,
  'recompute after restoring license recipients'
);
select lives_ok(
  $$select public.compute_rem_month((select company from rem_ctx), (select period from rem_ctx))$$,
  'idempotent second compute'
);

select is(
  (select amount_cents::text from public.company_fee_reserve_ledger
   where company_id = (select company from rem_ctx)
     and period_month = (select period from rem_ctx)),
  (
    select coalesce(sum(amount_cents),0)::text from public.rem_lines
    where company_id = (select company from rem_ctx) and bucket = 'company_fee'
  ),
  'fee reserve matches company_fee rem lines'
);

select * from finish();
rollback;
