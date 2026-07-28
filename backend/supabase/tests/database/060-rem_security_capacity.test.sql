-- Rem security: ledger write lockdown, cross-company isolation, capacity/vacation.
begin;
select plan(13);

create temporary table rem_sec (
  admin uuid,
  freel uuid,
  outsider uuid,
  company uuid,
  other_company uuid,
  pool uuid,
  period date
);
grant all on table rem_sec to authenticated, anon;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_freel uuid := gen_random_uuid();
  v_out uuid := gen_random_uuid();
  v_company uuid;
  v_other uuid;
  v_pool uuid;
  v_period date := '2026-08-01';
begin
  perform tests.create_auth_user(v_admin, 'rem-sec-admin@example.com');
  perform tests.create_auth_user(v_freel, 'rem-sec-freel@example.com');
  perform tests.create_auth_user(v_out, 'rem-sec-out@example.com');
  v_company := tests.make_company(v_admin, 'rem-sec-' || substr(v_admin::text, 1, 8));
  v_other := tests.make_company(v_out, 'rem-sec-o-' || substr(v_out::text, 1, 8));
  perform tests.add_member(v_company, v_freel, 'freelancer');

  update public.companies
  set company_fee_pct = 5, rem_max_percent = 75, default_license_pct = 30,
      default_hours_per_day = 8, max_vacation_days_per_year = 15
  where id = v_company;

  insert into public.projects (company_id, name, rem_policy, hours_per_day, created_by)
  values (v_company, 'Pool', 'product_pool', 8, v_admin)
  returning id into v_pool;

  update public.companies set product_pool_project_id = v_pool where id = v_company;

  insert into public.projects (company_id, name, rem_policy, hours_per_day, created_by)
  values (v_other, 'Other pool', 'product_pool', 8, v_out);

  insert into rem_sec values (v_admin, v_freel, v_out, v_company, v_other, v_pool, v_period);
end $$;

-- Freelancer cannot compute rem
select tests.authenticate_as((select freel from rem_sec));
select throws_ok(
  $$select public.compute_rem_month((select company from rem_sec), (select period from rem_sec))$$,
  'P0001',
  'Only a manager can compute rem month',
  'freelancer cannot compute rem month'
);

-- Outsider cannot compute
select tests.authenticate_as((select outsider from rem_sec));
select throws_ok(
  $$select public.compute_rem_month((select company from rem_sec), (select period from rem_sec))$$,
  'P0001',
  'Only a manager can compute rem month',
  'outsider cannot compute rem month'
);

-- Direct rem_lines insert blocked for managers (no write policy)
select tests.authenticate_as((select admin from rem_sec));
select lives_ok(
  $$select public.compute_rem_month((select company from rem_sec), (select period from rem_sec))$$,
  'admin can compute rem month (setup for forge attempts)'
);

select throws_ok(
  $$insert into public.rem_lines (month_id, company_id, user_id, project_id, bucket, amount_cents)
    select id, company_id, (select freel from rem_sec), null, 'product_pool', 100
    from public.rem_months
    where company_id = (select company from rem_sec) and period_month = (select period from rem_sec)$$,
  '42501'
);

select throws_ok(
  $$insert into public.company_fee_reserve_ledger (company_id, period_month, amount_cents)
    values ((select company from rem_sec), '2026-01-01', 999)$$,
  '42501'
);

-- Working weekdays empty rejected
reset role;
select throws_ok(
  $$update public.companies set working_weekdays = '{}'::integer[] where id = (select company from rem_sec)$$,
  'P0001',
  'working_weekdays must not be empty',
  'empty working_weekdays rejected'
);

select throws_ok(
  $$update public.companies set working_weekdays = array[1,1,2] where id = (select company from rem_sec)$$,
  'P0001',
  'working_weekdays must not contain duplicates',
  'duplicate working_weekdays rejected'
);

-- Vacation allowance (null max = unlimited; set explicit 15 for this test)
reset role;
update public.companies
set max_vacation_days_per_year = 15
where id = (select company from rem_sec);

do $$
declare
  v_company uuid;
  v_freel uuid;
  v_i integer;
begin
  select company, freel into v_company, v_freel from rem_sec;
  for v_i in 1..15 loop
    insert into public.time_off (company_id, user_id, off_date, kind, duration_minutes)
    values (v_company, v_freel, make_date(2026, 1, v_i), 'vacation', null);
  end loop;
end $$;

select throws_ok(
  $$insert into public.time_off (company_id, user_id, off_date, kind, duration_minutes)
    values ((select company from rem_sec), (select freel from rem_sec), '2026-02-01', 'vacation', null)$$,
  'P0001',
  'Vacation allowance exceeded (15 days/year)',
  '16th vacation day rejected'
);

-- Monthly capacity: 22 full days then reject
reset role;
do $$
declare
  v_company uuid;
  v_freel uuid;
  v_pool uuid;
  v_i integer;
begin
  select company, freel, pool into v_company, v_freel, v_pool from rem_sec;
  for v_i in 1..22 loop
    insert into public.time_entries (
      company_id, project_id, user_id, entry_date, duration_minutes, status
    ) values (
      v_company, v_pool, v_freel, make_date(2026, 8, least(v_i, 28)), 8 * 60, 'approved'
    );
  end loop;
end $$;

select throws_ok(
  $$insert into public.time_entries (
      company_id, project_id, user_id, entry_date, duration_minutes, status
    ) values (
      (select company from rem_sec), (select pool from rem_sec), (select freel from rem_sec),
      '2026-08-28', 60, 'approved'
    )$$,
  'P0001',
  'Monthly capacity exceeded (22 × 8h)',
  'time beyond 22×8 rejected'
);

-- product_pool_project_id must be product_pool in same company
reset role;
select throws_ok(
  $$update public.companies
    set product_pool_project_id = (
      select id from public.projects where company_id = (select other_company from rem_sec) limit 1
    )
    where id = (select company from rem_sec)$$,
  'P0001',
  'product_pool_project_id must reference an active product_pool project in this company',
  'cross-company pool project rejected'
);

-- Admin can compute empty month already covered above
select is(
  (select status::text from public.rem_months
   where company_id = (select company from rem_sec)
     and period_month = (select period from rem_sec)),
  'computed',
  'rem month status is computed'
);

-- Freelancer can read rem lines after compute
select tests.authenticate_as((select freel from rem_sec));
select isnt_empty(
  $$select 1 from public.rem_months where company_id = (select company from rem_sec)$$,
  'member can read rem_months'
);

-- Cross-company rem_months invisible
select is_empty(
  $$select 1 from public.rem_months where company_id = (select other_company from rem_sec)$$,
  'cross-company rem_months hidden'
);

select * from finish();
rollback;
