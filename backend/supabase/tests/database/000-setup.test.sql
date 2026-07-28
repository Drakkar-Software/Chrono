-- pgTAP smoke + shared helpers for company invite security tests.
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;

-- Supabase API roles must be able to DML public tables; RLS is the real gate.
-- Local resets sometimes leave only trivial privileges — restore the usual set for tests.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to authenticated;
-- Keep the invite helper locked down (setup grant-all must not reopen it).
revoke all on function public.internal_insert_member_from_invite(uuid, uuid, public.app_role) from public;
revoke all on function public.internal_insert_member_from_invite(uuid, uuid, public.app_role) from anon, authenticated;
revoke all on function public.accept_company_invite(text) from public;
revoke all on function public.accept_company_invite(text) from anon;
grant execute on function public.accept_company_invite(text) to authenticated;

grant usage on schema tests to anon, authenticated, service_role, postgres;

-- Test helpers (persist across test files in this suite run).
create or replace function tests.create_auth_user(p_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = extensions, auth, public
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_email,
    crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    format('{"full_name":"%s"}', p_email)::jsonb,
    now(), now()
  ) on conflict (id) do nothing;

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  select gen_random_uuid(), p_id, p_id,
    format('{"sub":"%s","email":"%s"}', p_id, p_email)::jsonb,
    'email', now(), now(), now()
  where not exists (select 1 from auth.identities where user_id = p_id);
end;
$$;

-- Sets JWT claims then switches to authenticated (session-local).
create or replace function tests.authenticate_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create or replace function tests.clear_auth()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function tests.make_company(p_admin uuid, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
begin
  insert into public.companies (slug, content, currency, created_by)
  values (p_slug, jsonb_build_object('name', p_slug), 'EUR', p_admin)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function tests.add_member(p_company uuid, p_user uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('chrono.accepting_invite', 'on', true);
  insert into public.company_members (company_id, user_id, role)
  values (p_company, p_user, p_role)
  on conflict (company_id, user_id) do update set role = excluded.role, deleted = false;
  perform set_config('chrono.accepting_invite', 'off', true);
end;
$$;

create or replace function tests.mint_invite(
  p_company uuid,
  p_email text,
  p_role public.app_role,
  p_invited_by uuid,
  p_token text default null,
  p_expires_at timestamptz default (now() + interval '14 days'),
  p_revoked_at timestamptz default null,
  p_accepted_at timestamptz default null,
  p_accepted_by uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := coalesce(p_token, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
begin
  insert into public.company_invites (
    company_id, email, role, token, invited_by, expires_at, revoked_at, accepted_at, accepted_by
  ) values (
    p_company, p_email, p_role, v_token, p_invited_by, p_expires_at, p_revoked_at, p_accepted_at, p_accepted_by
  );
  return v_token;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role, postgres;

begin;
select plan(1);
select ok(true, 'pgTAP setup completed');
select * from finish();
rollback;
