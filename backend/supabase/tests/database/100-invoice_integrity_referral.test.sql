-- Money-integrity guards that keep a freelancer from paying themselves:
--   * enforce_invoice_integrity  — server recomputes earned/tjm/hpd, freezes
--     settlement columns, tenant integrity, settled-status transitions,
--     cancellation frees tagged entries.
--   * enforce_referral_total     — active referral percents per project <= 100.
--   * project_referrals.percent  — per-row (0,100] CHECK.
--   * prevent_invoiced_entry_edit — a settled/tagged time entry is frozen.
begin;
select plan(16);

create temporary table ii_ctx (
  admin uuid, free uuid, other uuid, company uuid, other_company uuid,
  project uuid, ref_project uuid, inv uuid, te uuid
);
grant all on table ii_ctx to authenticated, anon;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_free uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_co uuid; v_oco uuid; v_pr uuid; v_rp uuid; v_te uuid;
  m date := '2026-04-01';
begin
  perform tests.create_auth_user(v_admin, 'ii-admin@example.com');
  perform tests.create_auth_user(v_free, 'ii-free@example.com');
  perform tests.create_auth_user(v_other, 'ii-other@example.com');
  v_co := tests.make_company(v_admin, 'ii-co-' || substr(v_admin::text, 1, 8));
  v_oco := tests.make_company(v_other, 'ii-oco-' || substr(v_other::text, 1, 8));
  perform tests.add_member(v_co, v_free, 'freelancer');

  insert into public.projects (company_id, name, hours_per_day, default_tjm_cents, created_by)
    values (v_co, 'Integrity', 8, 100000, v_admin) returning id into v_pr;
  insert into public.project_members (project_id, user_id, tjm_cents) values (v_pr, v_free, 100000);
  -- 1 approved billable day (480min) => earned should recompute to 100000.
  insert into public.time_entries (project_id, user_id, company_id, entry_date, duration_minutes, status, billable)
    values (v_pr, v_free, v_co, m + 5, 480, 'approved', true) returning id into v_te;
  -- Paid revenue so the invoice can settle later.
  insert into public.revenue_sources (company_id, project_id, type, name, content, created_by)
    values (v_co, v_pr, 'recurring', 'Retainer', '{"monthly_amount_cents":500000}'::jsonb, v_admin);

  -- A separate project for referral-total tests.
  insert into public.projects (company_id, name, created_by)
    values (v_co, 'Referrals', v_admin) returning id into v_rp;

  insert into ii_ctx values (v_admin, v_free, v_other, v_co, v_oco, v_pr, v_rp, null, v_te);
end $$;

-- ── enforce_invoice_integrity: server recomputes the earned side ──
-- Freelancer submits a draft trying to inflate earned/tjm/paid; all are overwritten.
select tests.authenticate_as((select free from ii_ctx));
do $$
declare v_id uuid;
begin
  insert into public.invoices (company_id, project_id, freelancer_id, period_month, status,
                               earned_cents, tjm_cents, amount_paid_cents, worked_minutes)
  values ((select company from ii_ctx), (select project from ii_ctx), (select free from ii_ctx),
          '2026-04-01', 'draft', 999999, 999999, 888888, 99999)
  returning id into v_id;
  update ii_ctx set inv = v_id;
end $$;

select is((select earned_cents::text from public.invoices where id = (select inv from ii_ctx)),
          '100000', 'earned_cents is recomputed from approved time (client-supplied value ignored)');
select is((select tjm_cents::text from public.invoices where id = (select inv from ii_ctx)),
          '100000', 'tjm_cents is snapshotted from the project member rate');
select is((select worked_minutes::text from public.invoices where id = (select inv from ii_ctx)),
          '480', 'worked_minutes is recomputed from approved time');
select is((select amount_paid_cents::text from public.invoices where id = (select inv from ii_ctx)),
          '0', 'amount_paid_cents is forced to 0 on a freelancer draft');
select is((select hours_per_day::text from public.invoices where id = (select inv from ii_ctx)),
          '8', 'hours_per_day is snapshotted from the project');

-- Tenant integrity: freelancer cannot point an invoice at a foreign company_id.
select throws_ok(
  $$insert into public.invoices (company_id, project_id, freelancer_id, period_month, status)
    values ((select other_company from ii_ctx), (select project from ii_ctx),
            (select free from ii_ctx), '2026-07-01', 'draft')$$,
  'invoice-company-mismatch',
  'invoice company_id must match its project'
);
select tests.clear_auth();

-- Manager cannot hand-write a settlement status.
select tests.authenticate_as((select admin from ii_ctx));
select throws_ok(
  $$update public.invoices set status = 'paid' where id = (select inv from ii_ctx)$$,
  'invoice-settlement-status-reserved',
  'a manager cannot set a settlement status directly'
);

-- Submit the invoice, mark revenue paid, settle it -> paid + entries tagged.
select tests.clear_auth();
select tests.authenticate_as((select free from ii_ctx));
select lives_ok($$update public.invoices set status = 'submitted' where id = (select inv from ii_ctx)$$,
                'freelancer submits the invoice');
select tests.clear_auth();

select tests.authenticate_as((select admin from ii_ctx));
select public.recognize_project_revenue((select project from ii_ctx), '2026-04-15');
select public.mark_revenue_entries_paid(
  array(select id from public.revenue_entries where project_id = (select project from ii_ctx)), true);
select public.settle_project_month((select project from ii_ctx), '2026-04-15');

select is((select status::text from public.invoices where id = (select inv from ii_ctx)),
          'paid', 'invoice settles to paid');
select is((select invoice_id from public.time_entries where id = (select te from ii_ctx)),
          (select inv from ii_ctx), 'settlement tags the time entry to the invoice');

-- prevent_invoiced_entry_edit: a tagged entry is frozen.
select throws_ok(
  $$update public.time_entries set duration_minutes = 120 where id = (select te from ii_ctx)$$,
  'time-entry-invoiced-locked',
  'a settled/tagged time entry cannot be edited'
);

-- A settled invoice can only be cancelled, never reverted to draft/submitted.
select throws_ok(
  $$update public.invoices set status = 'submitted' where id = (select inv from ii_ctx)$$,
  'invoice-settled-immutable',
  'a paid invoice cannot be reverted to submitted'
);

-- Cancelling frees the tagged entries and zeroes the payment.
select lives_ok(
  $$update public.invoices set status = 'cancelled' where id = (select inv from ii_ctx)$$,
  'manager cancels the settled invoice'
);
select is((select invoice_id from public.time_entries where id = (select te from ii_ctx)),
          null, 'cancellation frees the tagged time entry');

-- ── Referral guards ──
-- Per-row CHECK: percent must be strictly positive (the >100 bound is shadowed by
-- the enforce_referral_total trigger, so we exercise the lower bound here).
select throws_ok(
  $$insert into public.project_referrals (project_id, company_id, user_id, percent)
    values ((select ref_project from ii_ctx), (select company from ii_ctx), (select admin from ii_ctx), 0)$$,
  '23514', NULL,
  'a non-positive referral percent violates the row CHECK'
);

-- enforce_referral_total: two active referrals may not sum above 100.
insert into public.project_referrals (project_id, company_id, user_id, percent)
  values ((select ref_project from ii_ctx), (select company from ii_ctx), (select admin from ii_ctx), 60);
select throws_ok(
  $$insert into public.project_referrals (project_id, company_id, user_id, percent)
    values ((select ref_project from ii_ctx), (select company from ii_ctx), (select free from ii_ctx), 50)$$,
  'referral-total-exceeded:110.00',
  'active referral percents on a project cannot sum above 100'
);

select tests.clear_auth();
select * from finish();
rollback;
