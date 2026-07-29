-- Recurring revenue schedules: occurrence counting, month-by-month recognition,
-- re-recognition, retirement when a schedule shrinks, the range back-fill and
-- its authorization, and the legacy flat-monthly path staying untouched.
begin;
select plan(32);

create temporary table rev_freq_ctx (
  admin uuid,
  outsider uuid,
  company uuid,
  project uuid,
  src_weekly uuid,
  src_quarterly uuid,
  src_legacy uuid,
  src_daily uuid,
  src_anchorless uuid,
  src_bounded uuid
);
grant all on table rev_freq_ctx to authenticated, anon;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_company uuid;
  v_project uuid;
  v_weekly uuid;
  v_quarterly uuid;
  v_legacy uuid;
  v_daily uuid;
  v_anchorless uuid;
  v_bounded uuid;
begin
  perform tests.create_auth_user(v_admin, 'revfreq-admin@example.com');
  -- Belongs to no company: used to prove the range wrapper inherits the
  -- manager gate rather than quietly running for anyone.
  perform tests.create_auth_user(v_outsider, 'revfreq-outsider@example.com');
  v_company := tests.make_company(v_admin, 'revfreq-co-' || substr(v_admin::text, 1, 8));

  insert into public.projects (company_id, name, rem_policy, hours_per_day, created_by)
  values (v_company, 'Schedules', 'staffing', 8, v_admin)
  returning id into v_project;

  -- 500€ every week from Wednesday 2026-03-11.
  insert into public.revenue_sources
    (company_id, project_id, type, name, content, starts_on, created_by)
  values
    (v_company, v_project, 'recurring', 'Weekly retainer',
     jsonb_build_object('frequency', 'weekly', 'amount_cents', 50000),
     '2026-03-11', v_admin)
  returning id into v_weekly;

  -- 3000€ every quarter from 2026-03-15.
  insert into public.revenue_sources
    (company_id, project_id, type, name, content, starts_on, created_by)
  values
    (v_company, v_project, 'recurring', 'Quarterly licence',
     jsonb_build_object('frequency', 'quarterly', 'amount_cents', 300000),
     '2026-03-15', v_admin)
  returning id into v_quarterly;

  -- Pre-frequency source: flat monthly figure, no schedule, no starts_on.
  insert into public.revenue_sources
    (company_id, project_id, type, name, content, created_by)
  values
    (v_company, v_project, 'recurring', 'Legacy retainer',
     jsonb_build_object('monthly_amount_cents', 100000), v_admin)
  returning id into v_legacy;

  -- 10€ every calendar day from 2026-03-11.
  insert into public.revenue_sources
    (company_id, project_id, type, name, content, starts_on, created_by)
  values
    (v_company, v_project, 'recurring', 'Daily retainer',
     jsonb_build_object('frequency', 'daily', 'amount_cents', 1000),
     '2026-03-11', v_admin)
  returning id into v_daily;

  -- Hand-edited / imported shape: a frequency with no anchor to expand it.
  insert into public.revenue_sources
    (company_id, project_id, type, name, content, created_by)
  values
    (v_company, v_project, 'recurring', 'Anchorless retainer',
     jsonb_build_object('frequency', 'weekly', 'amount_cents', 70000), v_admin)
  returning id into v_anchorless;

  -- 200€ weekly for March only.
  insert into public.revenue_sources
    (company_id, project_id, type, name, content, starts_on, ends_on, created_by)
  values
    (v_company, v_project, 'recurring', 'Bounded retainer',
     jsonb_build_object('frequency', 'weekly', 'amount_cents', 20000),
     '2026-03-01', '2026-03-31', v_admin)
  returning id into v_bounded;

  insert into rev_freq_ctx values (
    v_admin, v_outsider, v_company, v_project,
    v_weekly, v_quarterly, v_legacy, v_daily, v_anchorless, v_bounded
  );
end $$;

-- ---------------------------------------------------------------------------
-- 1-11: the occurrence helper. Mirrors the `occurrencesInMonth` table in
-- packages/sdk/src/revenue-source/revenue-source.test.ts — keep them in step.
-- ---------------------------------------------------------------------------
select is(
  public.recurring_occurrences_in_month('weekly', '2026-03-11', null, '2026-03-01'),
  3,
  'weekly: Mar 11, 18, 25'
);
select is(
  public.recurring_occurrences_in_month('weekly', '2026-03-11', null, '2026-04-01'),
  5,
  'weekly: Apr 1, 8, 15, 22, 29'
);
select is(
  public.recurring_occurrences_in_month('biweekly', '2026-03-11', null, '2026-03-01'),
  2,
  'biweekly: Mar 11, 25'
);
select is(
  public.recurring_occurrences_in_month('daily', '2026-03-11', null, '2026-03-01'),
  21,
  'daily counts calendar days, weekends included'
);
select is(
  public.recurring_occurrences_in_month('monthly', '2026-01-31', null, '2026-02-01'),
  1,
  'a 31st anchor clamps to Feb 28 rather than vanishing'
);
select is(
  public.recurring_occurrences_in_month('monthly', '2028-01-31', null, '2028-02-01'),
  1,
  'a 31st anchor clamps to Feb 29 in a leap year'
);
select is(
  public.recurring_occurrences_in_month('quarterly', '2026-03-15', null, '2026-06-01'),
  1,
  'quarterly lands three months on'
);
select is(
  public.recurring_occurrences_in_month('quarterly', '2026-03-15', null, '2026-04-01'),
  0,
  'quarterly is idle off-cycle'
);
select is(
  public.recurring_occurrences_in_month('yearly', '2026-03-15', null, '2027-03-01'),
  1,
  'yearly lands twelve months on'
);
select is(
  public.recurring_occurrences_in_month('monthly', '2026-05-01', null, '2026-04-01'),
  0,
  'nothing before the schedule starts'
);
select is(
  public.recurring_occurrences_in_month('weekly', '2026-03-11', '2026-03-20', '2026-03-01'),
  2,
  'the end date truncates the month'
);

-- ---------------------------------------------------------------------------
-- 12-22: recognition writes one entry per month, sized by the schedule.
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select admin from rev_freq_ctx));

select lives_ok(
  $$select public.recognize_project_revenue((select project from rev_freq_ctx), '2026-03-01')$$,
  'recognizing March succeeds'
);
select lives_ok(
  $$select public.recognize_project_revenue((select project from rev_freq_ctx), '2026-04-01')$$,
  'recognizing April succeeds'
);

select is(
  (select amount_cents::text from public.revenue_entries
   where revenue_source_id = (select src_weekly from rev_freq_ctx)
     and period_month = '2026-03-01' and deleted = false),
  '150000',
  'weekly source recognizes 3 x 500€ in March'
);
select is(
  (select amount_cents::text from public.revenue_entries
   where revenue_source_id = (select src_weekly from rev_freq_ctx)
     and period_month = '2026-04-01' and deleted = false),
  '250000',
  'weekly source recognizes 5 x 500€ in April'
);
select is(
  (select amount_cents::text from public.revenue_entries
   where revenue_source_id = (select src_daily from rev_freq_ctx)
     and period_month = '2026-03-01' and deleted = false),
  '21000',
  'daily source bills all 21 calendar days from Mar 11, weekends included'
);
select is(
  (select amount_cents::text from public.revenue_entries
   where revenue_source_id = (select src_quarterly from rev_freq_ctx)
     and period_month = '2026-03-01' and deleted = false),
  '300000',
  'quarterly source recognizes its full amount on-cycle'
);
select is(
  (select count(*)::text from public.revenue_entries
   where revenue_source_id = (select src_quarterly from rev_freq_ctx)
     and period_month = '2026-04-01' and deleted = false),
  '0',
  'quarterly source writes no entry in an off-cycle month'
);
select is(
  (select string_agg(amount_cents::text, ',' order by period_month) from public.revenue_entries
   where revenue_source_id = (select src_legacy from rev_freq_ctx) and deleted = false),
  '100000,100000',
  'legacy flat-monthly source is untouched by the schedule work'
);
-- The TS mirror (`recurringRevenue`) pays one occurrence here. Reading
-- monthly_amount_cents instead would find nothing and silently pay zero.
select is(
  (select string_agg(amount_cents::text, ',' order by period_month) from public.revenue_entries
   where revenue_source_id = (select src_anchorless from rev_freq_ctx) and deleted = false),
  '70000,70000',
  'a frequency with no anchor pays one occurrence a month, not zero'
);
select is(
  (select amount_cents::text from public.revenue_entries
   where revenue_source_id = (select src_bounded from rev_freq_ctx)
     and period_month = '2026-03-01' and deleted = false),
  '100000',
  'bounded source bills its 5 March occurrences'
);
select is(
  (select count(*)::text from public.revenue_entries
   where revenue_source_id = (select src_bounded from rev_freq_ctx)
     and period_month = '2026-04-01' and deleted = false),
  '0',
  'bounded source stops at its end date'
);

-- ---------------------------------------------------------------------------
-- 23-24: re-recognizing a month is idempotent (partial unique index + upsert).
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.recognize_project_revenue((select project from rev_freq_ctx), '2026-03-01')$$,
  'March can be recognized a second time'
);
select is(
  (select count(*)::text || ':' || max(amount_cents)::text from public.revenue_entries
   where revenue_source_id = (select src_weekly from rev_freq_ctx)
     and period_month = '2026-03-01' and deleted = false),
  '1:150000',
  're-recognition updates in place, it does not duplicate'
);

-- ---------------------------------------------------------------------------
-- 25-27: the range wrapper back-fills every month, with the right amounts.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.recognize_project_revenue_range(
      (select project from rev_freq_ctx), '2026-03-01', '2026-06-01')$$,
  'range recognition succeeds'
);
select is(
  (select string_agg(to_char(period_month, 'YYYY-MM'), ',' order by period_month)
   from public.revenue_entries
   where revenue_source_id = (select src_weekly from rev_freq_ctx) and deleted = false),
  '2026-03,2026-04,2026-05,2026-06',
  'one call back-fills every month in the range'
);
select is(
  (select string_agg(amount_cents::text, ',' order by period_month)
   from public.revenue_entries
   where revenue_source_id = (select src_weekly from rev_freq_ctx) and deleted = false),
  '150000,250000,200000,200000',
  'each back-filled month is sized by its own occurrence count'
);

-- ---------------------------------------------------------------------------
-- 28-29: shrinking a schedule retires the months it no longer covers.
-- This is the branch that makes an off-cycle month safe; without it a source
-- that stops early would keep its already-recognized revenue on the books.
-- ---------------------------------------------------------------------------
reset role;
update public.revenue_sources
set ends_on = '2026-03-31'
where id = (select src_weekly from rev_freq_ctx);

select tests.authenticate_as((select admin from rev_freq_ctx));
select lives_ok(
  $$select public.recognize_project_revenue_range(
      (select project from rev_freq_ctx), '2026-03-01', '2026-06-01')$$,
  're-recognition after tightening the end date succeeds'
);
select is(
  (select string_agg(to_char(period_month, 'YYYY-MM'), ',' order by period_month)
   from public.revenue_entries
   where revenue_source_id = (select src_weekly from rev_freq_ctx) and deleted = false),
  '2026-03',
  'months past the new end date are retired, March survives'
);

-- ---------------------------------------------------------------------------
-- 30-32: authorization and range guards.
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select outsider from rev_freq_ctx));
select throws_ok(
  $$select public.recognize_project_revenue_range(
      (select project from rev_freq_ctx), '2026-03-01', '2026-04-01')$$,
  'P0001',
  'revenue-recognize-forbidden',
  'the range wrapper inherits the manager gate'
);

select tests.authenticate_as((select admin from rev_freq_ctx));
select throws_ok(
  $$select public.recognize_project_revenue_range(
      (select project from rev_freq_ctx), '2026-06-01', '2026-03-01')$$,
  'P0001',
  'revenue-range-invalid',
  'a backwards range raises the slug, not prose'
);
select throws_ok(
  $$select public.recognize_project_revenue_range(
      (select project from rev_freq_ctx), '1990-01-01', '2026-03-01')$$,
  'P0001',
  'revenue-range-too-wide:435',
  'an absurd back-fill raises the slug with its month count'
);

select * from finish();
rollback;
