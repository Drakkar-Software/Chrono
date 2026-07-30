-- recognize_project_revenue: per-source-type recognition math, the approved+
-- billable input filter, manager authorization, idempotent auto upsert, and the
-- retire-on-zero / retire-when-source-inactive behavior. This RPC feeds the
-- funding pool but had zero pgTAP coverage.
begin;
select plan(14);

create temporary table rr_ctx (
  admin uuid, free uuid, company uuid,
  p_rec uuid, p_tm uuid, p_manual uuid, p_self uuid,
  src_rec uuid, src_tm uuid, src_manual uuid, src_self uuid,
  period date
);
grant all on table rr_ctx to authenticated, anon;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_free  uuid := gen_random_uuid();
  v_co uuid;
  v_prec uuid; v_ptm uuid; v_pman uuid; v_pself uuid;
  v_srec uuid; v_stm uuid; v_sman uuid; v_sself uuid;
  v_period date := '2026-06-01';
begin
  perform tests.create_auth_user(v_admin, 'rr-admin@example.com');
  perform tests.create_auth_user(v_free,  'rr-free@example.com');
  v_co := tests.make_company(v_admin, 'rr-co-' || substr(v_admin::text, 1, 8));
  perform tests.add_member(v_co, v_free, 'freelancer');

  -- One project per revenue-source type; hours_per_day = 8 so 480min = 1 day.
  insert into public.projects (company_id, name, hours_per_day, created_by)
    values (v_co, 'Recurring',   8, v_admin) returning id into v_prec;
  insert into public.projects (company_id, name, hours_per_day, created_by)
    values (v_co, 'TimeBased',   8, v_admin) returning id into v_ptm;
  insert into public.projects (company_id, name, hours_per_day, created_by)
    values (v_co, 'ManualTB',    8, v_admin) returning id into v_pman;
  insert into public.projects (company_id, name, hours_per_day, created_by)
    values (v_co, 'SelfBilling', 8, v_admin) returning id into v_pself;

  perform tests.add_member(v_co, v_free, 'freelancer');
  insert into public.project_members (project_id, user_id) values (v_ptm,   v_free);
  insert into public.project_members (project_id, user_id) values (v_pself, v_free);

  insert into public.revenue_sources (company_id, project_id, type, name, content, created_by)
    values (v_co, v_prec, 'recurring', 'Retainer', '{"monthly_amount_cents":300000}'::jsonb, v_admin)
    returning id into v_srec;
  insert into public.revenue_sources (company_id, project_id, type, name, content, created_by)
    values (v_co, v_ptm, 'time_based', 'T&M', '{"client_tjm_cents":100000}'::jsonb, v_admin)
    returning id into v_stm;
  insert into public.revenue_sources (company_id, project_id, type, name, content, created_by)
    values (v_co, v_pman, 'time_based', 'ManualTB', '{"manual_amount_cents":123456}'::jsonb, v_admin)
    returning id into v_sman;
  insert into public.revenue_sources (company_id, project_id, type, name, content, created_by)
    values (v_co, v_pself, 'self_billing', 'Self', '{"client_tjm_cents":100000,"markup_pct":20}'::jsonb, v_admin)
    returning id into v_sself;

  -- Time-based project: 480 approved-billable min (=1 day) PLUS decoy entries that
  -- must NOT count (pending, and approved-but-non-billable).
  insert into public.time_entries (project_id, user_id, company_id, entry_date, duration_minutes, status, billable)
    values (v_ptm, v_free, v_co, v_period + 3, 480, 'approved', true),
           (v_ptm, v_free, v_co, v_period + 4, 300, 'pending',  true),
           (v_ptm, v_free, v_co, v_period + 5, 200, 'approved', false);
  -- Self-billing project: 480 approved-billable min (=1 day).
  insert into public.time_entries (project_id, user_id, company_id, entry_date, duration_minutes, status, billable)
    values (v_pself, v_free, v_co, v_period + 3, 480, 'approved', true);

  insert into rr_ctx values (v_admin, v_free, v_co, v_prec, v_ptm, v_pman, v_pself,
                             v_srec, v_stm, v_sman, v_sself, v_period);
end $$;

-- Authorization: a freelancer cannot recognize revenue.
select tests.authenticate_as((select free from rr_ctx));
select throws_ok(
  $$select public.recognize_project_revenue((select p_tm from rr_ctx), '2026-06-15')$$,
  'revenue-recognize-forbidden',
  'freelancer cannot recognize revenue'
);
select tests.clear_auth();

-- Manager recognizes all four projects.
select tests.authenticate_as((select admin from rr_ctx));
select lives_ok(
  $$select public.recognize_project_revenue((select p_rec from rr_ctx), '2026-06-15'),
           public.recognize_project_revenue((select p_tm from rr_ctx), '2026-06-15'),
           public.recognize_project_revenue((select p_manual from rr_ctx), '2026-06-15'),
           public.recognize_project_revenue((select p_self from rr_ctx), '2026-06-15')$$,
  'manager recognizes revenue for all source types'
);

-- project-not-found guard.
select throws_ok(
  $$select public.recognize_project_revenue('00000000-0000-0000-0000-000000000000', '2026-06-15')$$,
  'project-not-found',
  'recognize on a missing project raises project-not-found'
);

select is(
  (select amount_cents::text from public.revenue_entries
   where project_id = (select p_rec from rr_ctx) and deleted = false),
  '300000',
  'recurring recognizes the flat monthly_amount_cents'
);

select is(
  (select amount_cents::text from public.revenue_entries
   where project_id = (select p_tm from rr_ctx) and deleted = false),
  '100000',
  'time_based recognizes 1 day x client_tjm (pending + non-billable excluded)'
);

select is(
  (select amount_cents::text from public.revenue_entries
   where project_id = (select p_manual from rr_ctx) and deleted = false),
  '123456',
  'time_based with manual_amount_cents overrides the computed amount'
);

select is(
  (select amount_cents::text from public.revenue_entries
   where project_id = (select p_self from rr_ctx) and deleted = false),
  '120000',
  'self_billing applies the markup (100000 x 1.20)'
);

select is(
  (select type::text from public.revenue_entries
   where project_id = (select p_rec from rr_ctx) and deleted = false),
  'recurring',
  'entry carries the source type'
);

select is(
  (select period_month::text from public.revenue_entries
   where project_id = (select p_rec from rr_ctx) and deleted = false),
  '2026-06-01',
  'period_month is truncated to the first of the month'
);

select is(
  (select auto_generated::text from public.revenue_entries
   where project_id = (select p_rec from rr_ctx) and deleted = false),
  'true',
  'recognized entries are auto_generated'
);

-- Idempotency: recognizing again yields exactly one auto row with the same amount.
select lives_ok(
  $$select public.recognize_project_revenue((select p_rec from rr_ctx), '2026-06-15')$$,
  'second recognition is idempotent'
);
select is(
  (select count(*)::text from public.revenue_entries
   where project_id = (select p_rec from rr_ctx) and deleted = false),
  '1',
  'idempotent upsert keeps a single auto row per source-month'
);

-- Retire-when-inactive: deactivating the source and re-recognizing soft-deletes
-- the stale auto entry so it stops funding the pool.
update public.revenue_sources set active = false where id = (select src_rec from rr_ctx);
select public.recognize_project_revenue((select p_rec from rr_ctx), '2026-06-15');
select is(
  (select count(*)::text from public.revenue_entries
   where project_id = (select p_rec from rr_ctx) and deleted = false),
  '0',
  'deactivating a source retires (soft-deletes) its auto revenue entry'
);

-- In-window filter: a source whose window starts after the period recognizes nothing.
update public.revenue_sources set active = true, starts_on = '2026-09-01'
  where id = (select src_tm from rr_ctx);
update public.revenue_entries set deleted = true
  where project_id = (select p_tm from rr_ctx);
select public.recognize_project_revenue((select p_tm from rr_ctx), '2026-06-15');
select is(
  (select count(*)::text from public.revenue_entries
   where project_id = (select p_tm from rr_ctx) and deleted = false),
  '0',
  'a source not yet in-window recognizes no revenue for the period'
);

select tests.clear_auth();
select * from finish();
rollback;
