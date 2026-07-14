-- ============================================================================
-- Chrono — local seed data (applied by `supabase db reset`, runs as superuser)
--
-- Creates a demo admin user, a company, a project with revenue sources, a
-- member assignment and a referrer. Log in locally with:
--   email:    demo@chrono.dev
--   password: password123
-- ============================================================================
do $$
declare
  v_user_id  uuid := '00000000-0000-0000-0000-0000000000a1';
  v_company  uuid := '00000000-0000-0000-0000-0000000000c1';
  v_project  uuid := '00000000-0000-0000-0000-0000000000d1';
begin
  -- Demo auth user (idempotent) --------------------------------------------
  if not exists (select 1 from auth.users where id = v_user_id) then
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      'demo@chrono.dev',
      crypt('password123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Demo Admin"}',
      now(), now()
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id, v_user_id,
      format('{"sub":"%s","email":"demo@chrono.dev"}', v_user_id)::jsonb,
      'email', now(), now(), now()
    );
  end if;

  -- The on_auth_user_created trigger has created the profile; mark onboarded.
  update public.profiles set full_name = 'Demo Admin', onboarded = true where user_id = v_user_id;

  -- Company (the on_company_created trigger makes v_user_id an admin) --------
  if not exists (select 1 from public.companies where id = v_company) then
    insert into public.companies (id, slug, content, currency, created_by)
    values (v_company, 'demo-co', '{"name":"Demo Studio"}', 'EUR', v_user_id);
  end if;

  -- Project -----------------------------------------------------------------
  if not exists (select 1 from public.projects where id = v_project) then
    insert into public.projects (
      id, company_id, name, description, color, client_name,
      budget_cents, default_tjm_cents, hours_per_day, created_by
    ) values (
      v_project, v_company, 'Acme Redesign', 'Website redesign for Acme',
      '#4F7CFF', 'Acme Corp', 6000000, 50000, 7, v_user_id
    );
  end if;

  -- Assign the demo user to the project with a day rate ---------------------
  insert into public.project_members (project_id, user_id, tjm_cents)
  values (v_project, v_user_id, 45000)
  on conflict (project_id, user_id) do nothing;

  -- Revenue sources: a fixed monthly retainer + a time & materials contract -
  insert into public.revenue_sources (project_id, company_id, type, name, content, created_by)
  values
    (v_project, v_company, 'recurring', 'Monthly retainer',
     '{"monthly_amount_cents": 300000}', v_user_id),
    (v_project, v_company, 'time_based', 'T&M contract',
     '{"client_tjm_cents": 70000}', v_user_id)
  on conflict do nothing;

  -- Referrer: the demo user brought the client, earns 10% -------------------
  insert into public.project_referrals (project_id, company_id, user_id, percent)
  values (v_project, v_company, v_user_id, 10)
  on conflict (project_id, user_id) do nothing;
end $$;
