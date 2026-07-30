-- Unified project_costs: the kind-discriminated CHECK constraints, the
-- pool-funding cumulative math (project_cost_cumulative), and mark_project_costs_paid
-- authorization + the reimbursable-not-payable guard. Previously only touched
-- incidentally as a settlement input.
begin;
select plan(12);

create temporary table pc_ctx (
  admin uuid, free uuid, company uuid, project uuid, reimb_id uuid, recur_id uuid
);
grant all on table pc_ctx to authenticated, anon;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_free uuid := gen_random_uuid();
  v_co uuid; v_pr uuid; v_reimb uuid; v_recur uuid;
begin
  perform tests.create_auth_user(v_admin, 'pc-admin@example.com');
  perform tests.create_auth_user(v_free, 'pc-free@example.com');
  v_co := tests.make_company(v_admin, 'pc-co-' || substr(v_admin::text, 1, 8));
  perform tests.add_member(v_co, v_free, 'freelancer');
  insert into public.projects (company_id, name, created_by) values (v_co, 'Costs', v_admin) returning id into v_pr;
  insert into public.project_members (project_id, user_id) values (v_pr, v_free);

  -- A recurring auto-deduct cost (counts as paid every elapsed month).
  insert into public.project_costs (company_id, project_id, kind, label, amount_cents, active, starts_on, auto_deduct)
    values (v_co, v_pr, 'recurring', 'Server', 10000, true, '2026-01-01', true)
    returning id into v_recur;
  -- An approved reimbursable expense (belongs to the freelancer).
  insert into public.project_costs (company_id, project_id, kind, label, amount_cents, active,
                                    user_id, spent_on, status)
    values (v_co, v_pr, 'reimbursable', 'Taxi', 4200, true, v_free, '2026-02-10', 'approved')
    returning id into v_reimb;

  insert into pc_ctx values (v_admin, v_free, v_co, v_pr, v_reimb, v_recur);
end $$;

-- ── Kind-discriminated CHECK constraints ──
select throws_ok(
  $$insert into public.project_costs (company_id, project_id, kind, label, amount_cents, active)
    values ((select company from pc_ctx), (select project from pc_ctx), 'one_off', 'Bad', 100, true)$$,
  '23514', NULL,
  'a one_off cost without period_month violates project_costs_kind_fields'
);

-- reimbursable amount must be strictly positive.
select throws_ok(
  $$insert into public.project_costs (company_id, project_id, kind, label, amount_cents, active, user_id, spent_on, status)
    values ((select company from pc_ctx), (select project from pc_ctx), 'reimbursable', 'Zero', 0, true,
            (select free from pc_ctx), '2026-02-10', 'approved')$$,
  '23514', NULL,
  'a reimbursable cost with amount 0 violates project_costs_amount_bounds'
);

-- auto_deduct is only valid on recurring costs.
select throws_ok(
  $$insert into public.project_costs (company_id, project_id, kind, label, amount_cents, active, period_month, auto_deduct)
    values ((select company from pc_ctx), (select project from pc_ctx), 'one_off', 'AutoOneOff', 100, true, '2026-01-01', true)$$,
  '23514', NULL,
  'auto_deduct on a one_off cost violates project_costs_auto_deduct_scope'
);

-- reimbursable costs may never carry paid_at (they are reimbursed, not pool-deducted).
select throws_ok(
  $$insert into public.project_costs (company_id, project_id, kind, label, amount_cents, active, user_id, spent_on, status, paid_at)
    values ((select company from pc_ctx), (select project from pc_ctx), 'reimbursable', 'PaidReimb', 500, true,
            (select free from pc_ctx), '2026-02-10', 'approved', now())$$,
  '23514', NULL,
  'a reimbursable cost with paid_at violates project_costs_paid_scope'
);

-- lifecycle columns (approved_by, receipt_url, ...) are reimbursable-only.
select throws_ok(
  $$insert into public.project_costs (company_id, project_id, kind, label, amount_cents, active, period_month, receipt_url)
    values ((select company from pc_ctx), (select project from pc_ctx), 'one_off', 'Receipt', 100, true, '2026-01-01', 'http://x')$$,
  '23514', NULL,
  'a non-reimbursable cost with a receipt_url violates project_costs_lifecycle_scope'
);

-- ── project_cost_cumulative recurring math ──
select is(
  public.project_cost_cumulative((select project from pc_ctx), '2026-03-15')::text,
  '30000',
  'recurring auto-deduct cost accrues amount x elapsed months (Jan..Mar = 30000)'
);
select is(
  public.project_cost_cumulative((select project from pc_ctx), '2026-01-15')::text,
  '10000',
  'recurring cost accrues one month in its first month'
);
select is(
  public.project_cost_cumulative((select project from pc_ctx), '2025-12-15')::text,
  '0',
  'recurring cost accrues nothing before its start month'
);

-- The reimbursable expense (no paid_at, not auto-deduct) never funds/deducts the pool.
select is(
  (select coalesce(sum(amount_cents),0)::text from public.project_costs
   where kind = 'reimbursable' and paid_at is not null),
  '0',
  'reimbursable costs are excluded from the pool-cost gate'
);

-- ── mark_project_costs_paid authorization + reimbursable guard ──
select tests.authenticate_as((select free from pc_ctx));
select throws_ok(
  $$select public.mark_project_costs_paid(array[(select recur_id from pc_ctx)], true)$$,
  'project-costs-paid-forbidden',
  'a freelancer cannot mark project costs paid'
);
select tests.clear_auth();

select tests.authenticate_as((select admin from pc_ctx));
select throws_ok(
  $$select public.mark_project_costs_paid(array[(select reimb_id from pc_ctx)], true)$$,
  'project-cost-reimbursable-not-payable',
  'reimbursable costs cannot be marked pool-paid'
);
select lives_ok(
  $$select public.mark_project_costs_paid(array[(select recur_id from pc_ctx)], true)$$,
  'a manager can mark a non-reimbursable cost paid'
);
select tests.clear_auth();

select * from finish();
rollback;
