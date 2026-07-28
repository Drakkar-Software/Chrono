begin;
select plan(22);

select tests.create_auth_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'esc-admin@test.local');
select tests.create_auth_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'esc-mgr@test.local');
select tests.create_auth_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'esc-free@test.local');
select tests.create_auth_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'esc-outsider@test.local');

select tests.clear_auth();

create temporary table esc_ctx (company_id uuid) on commit drop;
grant all on table esc_ctx to authenticated, anon;

do $$
declare v_co uuid;
begin
  v_co := tests.make_company('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'esc-' || gen_random_uuid()::text);
  insert into esc_ctx values (v_co);
  perform tests.add_member(v_co, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'manager');
  perform tests.add_member(v_co, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'freelancer');
end $$;

-- 20 freelancer cannot insert outsider as admin
select tests.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3');
select throws_like(
  format(
    $f$insert into public.company_members (company_id, user_id, role)
       values ('%s', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'admin')$f$,
    (select company_id from esc_ctx)
  ),
  '%role-admin-grant-forbidden%',
  'Freelancer cannot INSERT outsider as admin'
);

-- 21 manager cannot insert outsider as admin
select tests.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2');
select throws_like(
  format(
    $f$insert into public.company_members (company_id, user_id, role)
       values ('%s', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'admin')$f$,
    (select company_id from esc_ctx)
  ),
  '%role-admin-grant-forbidden%',
  'Manager cannot INSERT another user as admin'
);

-- 22 freelancer UPDATE self to admin is a no-op under RLS (not a manager)
select tests.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3');
select lives_ok(
  format(
    $f$update public.company_members set role = 'admin'
       where company_id = '%s' and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'$f$,
    (select company_id from esc_ctx)
  ),
  'Freelancer UPDATE self to admin does not error (0-row RLS)'
);
select is(
  (select role::text from public.company_members
   where company_id = (select company_id from esc_ctx)
     and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'),
  'freelancer',
  'Freelancer role unchanged after self-UPDATE attempt'
);

-- 23 manager cannot promote freelancer to admin
select tests.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2');
select throws_like(
  format(
    $f$update public.company_members set role = 'admin'
       where company_id = '%s' and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'$f$,
    (select company_id from esc_ctx)
  ),
  '%role-admin-grant-forbidden%',
  'Manager cannot promote freelancer to admin'
);

-- 24 manager cannot demote admin
select throws_like(
  format(
    $f$update public.company_members set role = 'manager'
       where company_id = '%s' and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'$f$,
    (select company_id from esc_ctx)
  ),
  '%role-admin-grant-forbidden%',
  'Manager cannot demote admin'
);

-- 25 freelancer cannot escalate to manager (RLS 0-row)
select tests.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3');
select lives_ok(
  format(
    $f$update public.company_members set role = 'manager'
       where company_id = '%s' and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'$f$,
    (select company_id from esc_ctx)
  ),
  'Freelancer UPDATE to manager does not error (0-row RLS)'
);
select is(
  (select role::text from public.company_members
   where company_id = (select company_id from esc_ctx)
     and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'),
  'freelancer',
  'Freelancer cannot escalate to manager'
);

-- 26–27 client-set GUC must not allow escalation
select tests.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3');
select set_config('chrono.accepting_invite', 'on', true);
select throws_ok(
  format(
    $f$insert into public.company_members (company_id, user_id, role)
       values ('%s', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'admin')$f$,
    (select company_id from esc_ctx)
  ),
  '42501'
);
select lives_ok(
  format(
    $f$update public.company_members set role = 'admin'
       where company_id = '%s' and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'$f$,
    (select company_id from esc_ctx)
  ),
  'Client GUC + UPDATE still 0-row under RLS'
);
select is(
  (select role::text from public.company_members
   where company_id = (select company_id from esc_ctx)
     and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'),
  'freelancer',
  'Client GUC does not allow UPDATE to admin'
);
select set_config('chrono.accepting_invite', 'off', true);

-- 28 helper not executable by authenticated / anon
select ok(
  not has_function_privilege('authenticated', 'public.internal_insert_member_from_invite(uuid,uuid,public.app_role)', 'execute'),
  'authenticated cannot execute internal helper'
);
select ok(
  not has_function_privilege('anon', 'public.internal_insert_member_from_invite(uuid,uuid,public.app_role)', 'execute'),
  'anon cannot execute internal helper'
);

-- 29 GUC not left on after accept
select tests.clear_auth();
do $$
declare
  v_tok text;
begin
  v_tok := tests.mint_invite(
    (select company_id from esc_ctx), 'postguc@x.com', 'freelancer',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
  );
  perform tests.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4');
  perform public.accept_company_invite(v_tok);
end $$;
select is(
  coalesce(nullif(current_setting('chrono.accepting_invite', true), ''), 'off'),
  'off',
  'GUC cleared after accept'
);
select is(
  (select role::text from public.company_members
   where company_id = (select company_id from esc_ctx)
     and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'),
  'freelancer',
  'Invitee joined as freelancer'
);
select lives_ok(
  format(
    $f$update public.company_members set role = 'admin'
       where company_id = '%s' and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'$f$,
    (select company_id from esc_ctx)
  ),
  'Invitee self-escalate UPDATE is 0-row under RLS'
);
select is(
  (select role::text from public.company_members
   where company_id = (select company_id from esc_ctx)
     and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'),
  'freelancer',
  'After accept, invitee still cannot self-escalate'
);

-- 30 admin can still grant admin via UPDATE
select tests.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1');
select lives_ok(
  format(
    $f$update public.company_members set role = 'admin'
       where company_id = '%s' and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'$f$,
    (select company_id from esc_ctx)
  ),
  'Admin can promote manager to admin'
);

-- 31 bootstrap: new company creator is admin (as postgres; trigger path)
select tests.clear_auth();
create temporary table boot_ctx (company_id uuid) on commit drop;
do $$
declare v_co uuid;
begin
  v_co := tests.make_company('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'boot' || replace(gen_random_uuid()::text, '-', ''));
  insert into boot_ctx values (v_co);
end $$;
select ok(
  exists(
    select 1 from public.company_members
    where company_id = (select company_id from boot_ctx)
      and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'
      and role = 'admin'
  ),
  'company bootstrap still makes creator admin'
);

-- 57–59 catalog asserts
select ok(
  (select prosecdef from pg_proc where proname = 'accept_company_invite' and pronamespace = 'public'::regnamespace),
  'accept_company_invite is SECURITY DEFINER'
);
select ok(
  (select prosecdef from pg_proc where proname = 'internal_insert_member_from_invite' and pronamespace = 'public'::regnamespace),
  'internal helper is SECURITY DEFINER'
);
select ok(
  (select proconfig::text like '%search_path%' from pg_proc
   where proname = 'internal_insert_member_from_invite' and pronamespace = 'public'::regnamespace),
  'internal helper sets search_path'
);

select * from finish();
rollback;
