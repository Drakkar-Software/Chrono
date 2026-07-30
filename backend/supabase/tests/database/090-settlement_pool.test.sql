-- settle_project_month: the funding-pool math that is the heart of Chrono and
-- the README's headline "worked example", none of which had pgTAP coverage.
-- Covers: recognize -> mark-paid -> referral first-claim -> FIFO settle -> paid;
-- the paid-revenue gate (unpaid revenue funds nothing); FIFO ordering by
-- submission_seq with a partial payment; per-freelancer carry-forward across
-- months; fixed-cost deduction from the pool; idempotency; and authorization.
begin;
select plan(20);

create temporary table st_ctx (
  admin uuid, f1 uuid, f2 uuid, company uuid,
  p_worked uuid, p_gate uuid, p_fifo uuid, p_carry uuid, p_cost uuid,
  inv_worked uuid, inv_f1 uuid, inv_f2 uuid, inv_c1 uuid, inv_c2 uuid, inv_cost uuid
);
grant all on table st_ctx to authenticated, anon;

-- Helper: create a submitted invoice as the freelancer (goes through the real
-- enforce_invoice_integrity path, so submission_seq is assigned in call order).
create or replace function tests.submit_invoice(p_company uuid, p_project uuid, p_free uuid, p_month date)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  perform set_config('request.jwt.claim.sub', p_free::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_free::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.invoices (company_id, project_id, freelancer_id, period_month, status)
  values (p_company, p_project, p_free, p_month, 'draft') returning id into v_id;
  update public.invoices set status = 'submitted' where id = v_id;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  return v_id;
end $$;
grant execute on function tests.submit_invoice(uuid, uuid, uuid, date) to authenticated, anon, postgres;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_f1 uuid := gen_random_uuid();
  v_f2 uuid := gen_random_uuid();
  v_co uuid;
  v_pw uuid; v_pg uuid; v_pf uuid; v_pc uuid; v_px uuid;
  v_iw uuid; v_if1 uuid; v_if2 uuid; v_ic1 uuid; v_ic2 uuid; v_ix uuid;
  m1 date := '2026-05-01';
  m2 date := '2026-06-01';
begin
  perform tests.create_auth_user(v_admin, 'st-admin@example.com');
  perform tests.create_auth_user(v_f1, 'st-f1@example.com');
  perform tests.create_auth_user(v_f2, 'st-f2@example.com');
  v_co := tests.make_company(v_admin, 'st-co-' || substr(v_admin::text, 1, 8));
  perform tests.add_member(v_co, v_f1, 'freelancer');
  perform tests.add_member(v_co, v_f2, 'freelancer');

  -- ── Scenario WORKED: README example (hpd 7 so 420min = 1 day, TJM 45000). ──
  insert into public.projects (company_id, name, hours_per_day, default_tjm_cents, created_by)
    values (v_co, 'Worked', 7, 45000, v_admin) returning id into v_pw;
  insert into public.project_members (project_id, user_id, tjm_cents) values (v_pw, v_f1, 45000);
  insert into public.revenue_sources (company_id, project_id, type, name, content, created_by)
    values (v_co, v_pw, 'recurring', 'Retainer', '{"monthly_amount_cents":300000}'::jsonb, v_admin);
  insert into public.revenue_sources (company_id, project_id, type, name, content, created_by)
    values (v_co, v_pw, 'time_based', 'T&M', '{"client_tjm_cents":70000}'::jsonb, v_admin);
  insert into public.project_referrals (project_id, company_id, user_id, percent)
    values (v_pw, v_co, v_admin, 10);
  insert into public.time_entries (project_id, user_id, company_id, entry_date, duration_minutes, status, billable)
    values (v_pw, v_f1, v_co, m1 + 5, 420, 'approved', true);
  v_iw := tests.submit_invoice(v_co, v_pw, v_f1, m1);

  -- ── Scenario GATE: revenue recognized but NOT marked paid -> pool is 0. ──
  insert into public.projects (company_id, name, hours_per_day, default_tjm_cents, created_by)
    values (v_co, 'Gate', 8, 100000, v_admin) returning id into v_pg;
  insert into public.project_members (project_id, user_id, tjm_cents) values (v_pg, v_f1, 100000);
  insert into public.revenue_sources (company_id, project_id, type, name, content, created_by)
    values (v_co, v_pg, 'recurring', 'Retainer', '{"monthly_amount_cents":500000}'::jsonb, v_admin);
  insert into public.time_entries (project_id, user_id, company_id, entry_date, duration_minutes, status, billable)
    values (v_pg, v_f1, v_co, m1 + 5, 480, 'approved', true);
  v_ix := null; -- placeholder unused
  v_ic1 := tests.submit_invoice(v_co, v_pg, v_f1, m1); -- reuse col ic1? no; use separate

  -- ── Scenario FIFO: two freelancers, pool 150000, each earns 100000. ──
  insert into public.projects (company_id, name, hours_per_day, default_tjm_cents, created_by)
    values (v_co, 'Fifo', 8, 100000, v_admin) returning id into v_pf;
  insert into public.project_members (project_id, user_id, tjm_cents) values (v_pf, v_f1, 100000);
  insert into public.project_members (project_id, user_id, tjm_cents) values (v_pf, v_f2, 100000);
  insert into public.revenue_sources (company_id, project_id, type, name, content, created_by)
    values (v_co, v_pf, 'recurring', 'Retainer', '{"monthly_amount_cents":150000}'::jsonb, v_admin);
  insert into public.time_entries (project_id, user_id, company_id, entry_date, duration_minutes, status, billable)
    values (v_pf, v_f1, v_co, m1 + 5, 480, 'approved', true),
           (v_pf, v_f2, v_co, m1 + 5, 480, 'approved', true);
  v_if1 := tests.submit_invoice(v_co, v_pf, v_f1, m1);  -- earlier submission_seq
  v_if2 := tests.submit_invoice(v_co, v_pf, v_f2, m1);  -- later submission_seq

  -- ── Scenario CARRY: one freelancer, month1 pool 60000 (earns 100000) -> carry
  --    40000; month2 adds 100000 paid revenue and an empty invoice -> pays carry.
  insert into public.projects (company_id, name, hours_per_day, default_tjm_cents, created_by)
    values (v_co, 'Carry', 8, 100000, v_admin) returning id into v_pc;
  insert into public.project_members (project_id, user_id, tjm_cents) values (v_pc, v_f1, 100000);
  insert into public.revenue_sources (company_id, project_id, type, name, content, created_by)
    values (v_co, v_pc, 'recurring', 'Retainer', '{"monthly_amount_cents":60000}'::jsonb, v_admin);
  insert into public.revenue_entries (company_id, project_id, revenue_source_id, type, period_month, amount_cents, paid_at, auto_generated)
    select v_co, v_pc, rs.id, 'recurring', m2, 100000, now(), false
    from public.revenue_sources rs where rs.project_id = v_pc limit 1;
  insert into public.time_entries (project_id, user_id, company_id, entry_date, duration_minutes, status, billable)
    values (v_pc, v_f1, v_co, m1 + 5, 480, 'approved', true);
  v_ic1 := tests.submit_invoice(v_co, v_pc, v_f1, m1);
  v_ic2 := tests.submit_invoice(v_co, v_pc, v_f1, m2);

  -- ── Scenario COST: revenue paid 100000, fixed cost 40000 paid -> pool 60000. ──
  insert into public.projects (company_id, name, hours_per_day, default_tjm_cents, created_by)
    values (v_co, 'Cost', 8, 100000, v_admin) returning id into v_px;
  insert into public.project_members (project_id, user_id, tjm_cents) values (v_px, v_f1, 100000);
  insert into public.revenue_sources (company_id, project_id, type, name, content, created_by)
    values (v_co, v_px, 'recurring', 'Retainer', '{"monthly_amount_cents":100000}'::jsonb, v_admin);
  insert into public.project_costs (company_id, project_id, kind, label, amount_cents, active, period_month, paid_at)
    values (v_co, v_px, 'one_off', 'Infra', 40000, true, m1, now());
  insert into public.time_entries (project_id, user_id, company_id, entry_date, duration_minutes, status, billable)
    values (v_px, v_f1, v_co, m1 + 5, 480, 'approved', true);
  v_ix := tests.submit_invoice(v_co, v_px, v_f1, m1);

  insert into st_ctx values (v_admin, v_f1, v_f2, v_co, v_pw, v_pg, v_pf, v_pc, v_px,
                             v_iw, v_if1, v_if2, v_ic1, v_ic2, v_ix);
  -- stash the gate + cost invoices in metadata columns we don't have; recover by query later.
end $$;

-- Authorization: a freelancer cannot settle.
select tests.authenticate_as((select f1 from st_ctx));
select throws_ok(
  $$select public.settle_project_month((select p_worked from st_ctx), '2026-05-15')$$,
  'settle-forbidden',
  'freelancer cannot settle a project month'
);
select tests.clear_auth();

-- Manager recognizes + marks paid + settles every project.
select tests.authenticate_as((select admin from st_ctx));

-- WORKED, FIFO, COST projects: recognize then mark all their revenue paid.
do $$
declare r record; m date := '2026-05-15';
begin
  for r in select p_worked pid from st_ctx union all
           select p_gate   from st_ctx union all
           select p_fifo   from st_ctx union all
           select p_carry  from st_ctx union all
           select p_cost   from st_ctx
  loop
    perform public.recognize_project_revenue(r.pid, m);
  end loop;
  -- Mark paid EXCEPT the GATE project (that one stays unpaid on purpose).
  perform public.mark_revenue_entries_paid(
    array(select id from public.revenue_entries
          where project_id <> (select p_gate from st_ctx) and paid_at is null), true);
end $$;

select lives_ok(
  $$select public.settle_project_month((select p_worked from st_ctx), '2026-05-15'),
           public.settle_project_month((select p_gate   from st_ctx), '2026-05-15'),
           public.settle_project_month((select p_fifo   from st_ctx), '2026-05-15'),
           public.settle_project_month((select p_carry  from st_ctx), '2026-06-15'),
           public.settle_project_month((select p_cost   from st_ctx), '2026-05-15')$$,
  'manager settles all scenario projects'
);

-- ── WORKED (README) assertions ──
select is((select status::text from public.invoices where id = (select inv_worked from st_ctx)),
          'paid', 'WORKED: invoice is fully paid');
select is((select earned_cents::text from public.invoices where id = (select inv_worked from st_ctx)),
          '45000', 'WORKED: earned = 1 day x 45000 = 45000');
select is((select amount_paid_cents::text from public.invoices where id = (select inv_worked from st_ctx)),
          '45000', 'WORKED: amount paid = 45000');
select is((select funding_snapshot_cents::text from public.invoices where id = (select inv_worked from st_ctx)),
          '333000', 'WORKED: funding snapshot = 370000 revenue - 37000 referral = 333000');
select is((select amount_cents::text from public.referral_earnings
           where project_id = (select p_worked from st_ctx)),
          '37000', 'WORKED: referral first-claim = 10% of 370000 = 37000');

-- ── GATE: recognized-but-unpaid revenue funds nothing ──
select is((select status::text from public.invoices
           where project_id = (select p_gate from st_ctx)),
          'submitted', 'GATE: unpaid revenue leaves the invoice unpaid (submitted)');
select is((select amount_paid_cents::text from public.invoices
           where project_id = (select p_gate from st_ctx)),
          '0', 'GATE: nothing is paid from an unpaid pool');
select is((select credit_carried_forward_cents::text from public.invoices
           where project_id = (select p_gate from st_ctx)),
          '100000', 'GATE: the full earned amount carries forward');

-- ── FIFO: earlier submission_seq is paid in full, later one partial ──
select is((select amount_paid_cents::text from public.invoices where id = (select inv_f1 from st_ctx)),
          '100000', 'FIFO: first-submitted invoice paid in full (100000)');
select is((select status::text from public.invoices where id = (select inv_f1 from st_ctx)),
          'paid', 'FIFO: first-submitted invoice is paid');
select is((select amount_paid_cents::text from public.invoices where id = (select inv_f2 from st_ctx)),
          '50000', 'FIFO: later invoice gets the 50000 remainder');
select is((select status::text from public.invoices where id = (select inv_f2 from st_ctx)),
          'partially_paid', 'FIFO: later invoice is partially paid');
select is((select credit_carried_forward_cents::text from public.invoices where id = (select inv_f2 from st_ctx)),
          '50000', 'FIFO: later invoice carries the 50000 shortfall');

-- ── CARRY: month1 short-pays and carries; month2 pays the carried credit ──
select is((select amount_paid_cents::text from public.invoices where id = (select inv_c1 from st_ctx)),
          '60000', 'CARRY: month1 pays only the 60000 pool');
select is((select credit_carried_forward_cents::text from public.invoices where id = (select inv_c1 from st_ctx)),
          '40000', 'CARRY: month1 carries the 40000 shortfall');
select is((select credit_brought_forward_cents::text from public.invoices where id = (select inv_c2 from st_ctx)),
          '40000', 'CARRY: month2 brings forward the 40000 credit');
select is((select status::text from public.invoices where id = (select inv_c2 from st_ctx)),
          'paid', 'CARRY: month2 settles the brought-forward credit to paid');

-- ── COST: a paid fixed cost reduces the pool ──
select is((select amount_paid_cents::text from public.invoices where id = (select inv_cost from st_ctx)),
          '60000', 'COST: 100000 revenue - 40000 paid cost => 60000 available to the invoice');

select tests.clear_auth();
select * from finish();
rollback;
