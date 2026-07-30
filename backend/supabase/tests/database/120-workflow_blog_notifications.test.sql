-- Cross-cutting feature checks with no prior coverage:
--   * assign_invoice_number  — sequential YYYY-NNNN stamped on draft->submitted.
--   * time-entry workflow     — approver stamping + the AFTER-INSERT / review
--     notification emitters (manager notified on submit, freelancer on review).
--   * enforce_time_entry_month_net_non_negative — signed corrections can't drive
--     a (user, project, month) net below zero.
--   * blog_articles RLS       — only published, non-deleted articles are readable.
begin;
select plan(11);

create temporary table wf_ctx (
  admin uuid, free uuid, company uuid, project uuid, te uuid, inv1 uuid, inv2 uuid
);
grant all on table wf_ctx to authenticated, anon;

-- Submit-invoice helper (plain function: SECURITY DEFINER may not SET ROLE).
create or replace function tests.wf_submit_invoice(p_company uuid, p_project uuid, p_free uuid, p_month date)
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
grant execute on function tests.wf_submit_invoice(uuid, uuid, uuid, date) to authenticated, anon, postgres;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_free uuid := gen_random_uuid();
  v_co uuid; v_pr uuid; v_te uuid; v_i1 uuid; v_i2 uuid;
begin
  perform tests.create_auth_user(v_admin, 'wf-admin@example.com');
  perform tests.create_auth_user(v_free, 'wf-free@example.com');
  v_co := tests.make_company(v_admin, 'wf-co-' || substr(v_admin::text, 1, 8));
  perform tests.add_member(v_co, v_free, 'freelancer');
  insert into public.projects (company_id, name, hours_per_day, default_tjm_cents, created_by)
    values (v_co, 'WF', 8, 100000, v_admin) returning id into v_pr;
  insert into public.project_members (project_id, user_id, tjm_cents) values (v_pr, v_free, 100000);

  -- Two submitted invoices (different months) => sequential numbers.
  v_i1 := tests.wf_submit_invoice(v_co, v_pr, v_free, '2026-03-01');
  v_i2 := tests.wf_submit_invoice(v_co, v_pr, v_free, '2026-04-01');

  -- Seed one published + one draft blog article.
  insert into public.blog_articles (slug, content, status, published_at)
    values ('hello-published', '{"title":"Hi"}'::jsonb, 'published', now());
  insert into public.blog_articles (slug, content, status)
    values ('secret-draft', '{"title":"WIP"}'::jsonb, 'draft');

  insert into wf_ctx values (v_admin, v_free, v_co, v_pr, null, v_i1, v_i2);
end $$;

-- ── Invoice numbering ──
select is(
  (select invoice_number from public.invoices where id = (select inv1 from wf_ctx)),
  '2026-0001',
  'first submitted invoice is numbered YYYY-0001'
);
select is(
  (select invoice_number from public.invoices where id = (select inv2 from wf_ctx)),
  '2026-0002',
  'second submitted invoice increments the per-year counter'
);
select isnt(
  (select issued_on from public.invoices where id = (select inv1 from wf_ctx)),
  null,
  'submitting stamps issued_on'
);

-- ── Time-entry workflow: log (as freelancer) -> notification to the manager ──
select tests.authenticate_as((select free from wf_ctx));
do $$
declare v_id uuid;
begin
  insert into public.time_entries (project_id, user_id, company_id, entry_date, duration_minutes, status, billable)
  values ((select project from wf_ctx), (select free from wf_ctx), (select company from wf_ctx),
          '2026-03-10', 480, 'pending', true)
  returning id into v_id;
  update wf_ctx set te = v_id;
end $$;
select tests.clear_auth();

select is(
  (select count(*)::text from public.notifications
   where type = 'time_submitted' and user_id = (select admin from wf_ctx)),
  '1',
  'logging time notifies the manager (time_submitted)'
);

-- Manager approves -> approver stamped + freelancer notified.
select tests.authenticate_as((select admin from wf_ctx));
select lives_ok(
  $$update public.time_entries set status = 'approved' where id = (select te from wf_ctx)$$,
  'manager approves the time entry'
);
select is(
  (select approved_by from public.time_entries where id = (select te from wf_ctx)),
  (select admin from wf_ctx),
  'approval stamps approved_by with the manager'
);
select isnt(
  (select approved_at from public.time_entries where id = (select te from wf_ctx)),
  null,
  'approval stamps approved_at'
);
select tests.clear_auth();

-- Count as postgres (owner bypasses notifications RLS, which scopes rows to their
-- recipient). The recipient here is the freelancer, not the acting manager.
select is(
  (select count(*)::text from public.notifications
   where type = 'time_approved' and user_id = (select free from wf_ctx)),
  '1',
  'approving notifies the freelancer (time_approved)'
);

-- ── Correction net-non-negative guard ──
-- The approved 480 exists; a -600 correction would net the month to -120. The
-- BEFORE trigger fires ahead of RLS, so this holds regardless of the acting role.
select throws_like(
  $$insert into public.time_entries (project_id, user_id, company_id, entry_date, duration_minutes, status, billable)
    values ((select project from wf_ctx), (select free from wf_ctx), (select company from wf_ctx),
            '2026-03-11', -600, 'approved', true)$$,
  'time-net-negative-correction:%',
  'a correction cannot drive the month net below zero'
);

-- ── Blog RLS: only published, non-deleted articles are visible ──
select tests.authenticate_as((select free from wf_ctx));
select is(
  (select count(*)::text from public.blog_articles where slug = 'hello-published'),
  '1',
  'a published article is readable'
);
select is(
  (select count(*)::text from public.blog_articles where slug = 'secret-draft'),
  '0',
  'a draft article is hidden by RLS'
);
select tests.clear_auth();

select * from finish();
rollback;
