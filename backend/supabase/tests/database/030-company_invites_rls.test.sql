begin;
select plan(22);

select tests.create_auth_user('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'rls-admin-a@test.local');
select tests.create_auth_user('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'rls-mgr-a@test.local');
select tests.create_auth_user('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'rls-free-a@test.local');
select tests.create_auth_user('cccccccc-cccc-cccc-cccc-ccccccccccc4', 'rls-admin-b@test.local');
select tests.create_auth_user('cccccccc-cccc-cccc-cccc-ccccccccccc5', 'rls-outsider@test.local');

select tests.clear_auth();

create temporary table rls_ctx (
  company_a uuid,
  company_b uuid,
  invite_a text,
  invite_id uuid
) on commit drop;
grant all on table rls_ctx to authenticated, anon;

do $$
declare
  a uuid;
  b uuid;
  tok text;
  iid uuid;
begin
  a := tests.make_company('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'rls-a-' || gen_random_uuid()::text);
  b := tests.make_company('cccccccc-cccc-cccc-cccc-ccccccccccc4', 'rls-b-' || gen_random_uuid()::text);
  perform tests.add_member(a, 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'manager');
  perform tests.add_member(a, 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'freelancer');
  tok := tests.mint_invite(a, 'pending@x.com', 'freelancer', 'cccccccc-cccc-cccc-cccc-ccccccccccc1');
  select id into iid from public.company_invites where token = tok;
  insert into rls_ctx values (a, b, tok, iid);
end $$;

-- 32 manager creates freelancer invite
select tests.authenticate_as('cccccccc-cccc-cccc-cccc-ccccccccccc2');
select lives_ok(
  format(
    $f$insert into public.company_invites (company_id, email, role, invited_by)
       values ('%s', 'new@x.com', 'freelancer', 'cccccccc-cccc-cccc-cccc-ccccccccccc2')$f$,
    (select company_a from rls_ctx)
  ),
  'Manager can create freelancer invite'
);

-- 33 forged invited_by rejected
select throws_ok(
  format(
    $f$insert into public.company_invites (company_id, email, role, invited_by)
       values ('%s', 'forge@x.com', 'freelancer', 'cccccccc-cccc-cccc-cccc-ccccccccccc1')$f$,
    (select company_a from rls_ctx)
  ),
  '42501'
);

-- 34–35 manager cannot create elevated invites
select throws_ok(
  format(
    $f$insert into public.company_invites (company_id, email, role, invited_by)
       values ('%s', 'mgr@x.com', 'manager', 'cccccccc-cccc-cccc-cccc-ccccccccccc2')$f$,
    (select company_a from rls_ctx)
  ),
  '42501'
);
select throws_ok(
  format(
    $f$insert into public.company_invites (company_id, email, role, invited_by)
       values ('%s', 'adm@x.com', 'admin', 'cccccccc-cccc-cccc-cccc-ccccccccccc2')$f$,
    (select company_a from rls_ctx)
  ),
  '42501'
);

-- 36 admin can create manager + admin invites
select tests.authenticate_as('cccccccc-cccc-cccc-cccc-ccccccccccc1');
select lives_ok(
  format(
    $f$insert into public.company_invites (company_id, email, role, invited_by)
       values ('%s', 'ok-mgr@x.com', 'manager', 'cccccccc-cccc-cccc-cccc-ccccccccccc1')$f$,
    (select company_a from rls_ctx)
  ),
  'Admin can create manager invite'
);
select lives_ok(
  format(
    $f$insert into public.company_invites (company_id, email, role, invited_by)
       values ('%s', 'ok-adm@x.com', 'admin', 'cccccccc-cccc-cccc-cccc-ccccccccccc1')$f$,
    (select company_a from rls_ctx)
  ),
  'Admin can create admin invite'
);

-- 37 freelancer / outsider cannot create
select tests.authenticate_as('cccccccc-cccc-cccc-cccc-ccccccccccc3');
select throws_ok(
  format(
    $f$insert into public.company_invites (company_id, email, role, invited_by)
       values ('%s', 'no@x.com', 'freelancer', 'cccccccc-cccc-cccc-cccc-ccccccccccc3')$f$,
    (select company_a from rls_ctx)
  ),
  '42501'
);
select tests.authenticate_as('cccccccc-cccc-cccc-cccc-ccccccccccc5');
select throws_ok(
  format(
    $f$insert into public.company_invites (company_id, email, role, invited_by)
       values ('%s', 'out@x.com', 'freelancer', 'cccccccc-cccc-cccc-cccc-ccccccccccc5')$f$,
    (select company_a from rls_ctx)
  ),
  '42501'
);

-- 38 freelancer cannot select invites (token leak)
select tests.authenticate_as('cccccccc-cccc-cccc-cccc-ccccccccccc3');
select is(
  (select count(*)::int from public.company_invites where company_id = (select company_a from rls_ctx)),
  0,
  'Freelancer cannot SELECT company invites'
);

-- 39 cross-tenant: manager A cannot see/update/delete B invites
select tests.clear_auth();
do $$
declare tok text;
begin
  tok := tests.mint_invite(
    (select company_b from rls_ctx), 'b@x.com', 'freelancer',
    'cccccccc-cccc-cccc-cccc-ccccccccccc4'
  );
  update rls_ctx set invite_a = tok; -- reuse field for B token briefly
end $$;

select tests.authenticate_as('cccccccc-cccc-cccc-cccc-ccccccccccc2');
select is(
  (select count(*)::int from public.company_invites where company_id = (select company_b from rls_ctx)),
  0,
  'Manager A cannot SELECT company B invites'
);
select lives_ok(
  format(
    $f$update public.company_invites set revoked_at = now()
       where company_id = '%s'$f$,
    (select company_b from rls_ctx)
  ),
  'Manager A UPDATE on B invites is 0-row under RLS'
);
select tests.clear_auth();
select is(
  (select count(*)::int from public.company_invites
    where company_id = (select company_b from rls_ctx) and revoked_at is not null),
  0,
  'Manager A cannot UPDATE company B invites'
);
select tests.authenticate_as('cccccccc-cccc-cccc-cccc-ccccccccccc2');

-- 40 manager A cannot insert invite for company B
select throws_ok(
  format(
    $f$insert into public.company_invites (company_id, email, role, invited_by)
       values ('%s', 'cross@x.com', 'freelancer', 'cccccccc-cccc-cccc-cccc-ccccccccccc2')$f$,
    (select company_b from rls_ctx)
  ),
  '42501'
);

-- 42 manager can revoke
select tests.clear_auth();
do $$
declare tok text; iid uuid;
begin
  tok := tests.mint_invite(
    (select company_a from rls_ctx), 'revoke-me@x.com', 'freelancer',
    'cccccccc-cccc-cccc-cccc-ccccccccccc1'
  );
  select id into iid from public.company_invites where token = tok;
  update rls_ctx set invite_id = iid, invite_a = tok;
end $$;
select tests.authenticate_as('cccccccc-cccc-cccc-cccc-ccccccccccc2');
select lives_ok(
  format(
    $f$update public.company_invites set revoked_at = now() where id = '%s'$f$,
    (select invite_id from rls_ctx)
  ),
  'Manager can revoke pending invite'
);

-- 43 manager cannot escalate invite role to admin
select tests.clear_auth();
do $$
declare tok text; iid uuid;
begin
  tok := tests.mint_invite(
    (select company_a from rls_ctx), 'esc-role@x.com', 'freelancer',
    'cccccccc-cccc-cccc-cccc-ccccccccccc1'
  );
  select id into iid from public.company_invites where token = tok;
  update rls_ctx set invite_id = iid;
end $$;
select tests.authenticate_as('cccccccc-cccc-cccc-cccc-ccccccccccc2');
select throws_like(
  format(
    $f$update public.company_invites set role = 'admin' where id = '%s'$f$,
    (select invite_id from rls_ctx)
  ),
  '%admin%',
  'Manager cannot escalate invite role to admin'
);

-- 44 admin can change invite role to admin
select tests.authenticate_as('cccccccc-cccc-cccc-cccc-ccccccccccc1');
select lives_ok(
  format(
    $f$update public.company_invites set role = 'admin' where id = '%s'$f$,
    (select invite_id from rls_ctx)
  ),
  'Admin can change invite role to admin'
);

-- 45 manager cannot mutate token
select tests.authenticate_as('cccccccc-cccc-cccc-cccc-ccccccccccc2');
select throws_like(
  format(
    $f$update public.company_invites set token = 'forgedtoken' where id = '%s'$f$,
    (select invite_id from rls_ctx)
  ),
  '%identity%',
  'Manager cannot mutate invite token'
);

-- 46 manager can DELETE invite
select tests.clear_auth();
do $$
declare tok text; iid uuid;
begin
  tok := tests.mint_invite(
    (select company_a from rls_ctx), 'del@x.com', 'freelancer',
    'cccccccc-cccc-cccc-cccc-ccccccccccc1'
  );
  select id into iid from public.company_invites where token = tok;
  update rls_ctx set invite_id = iid, invite_a = tok;
end $$;
select tests.authenticate_as('cccccccc-cccc-cccc-cccc-ccccccccccc2');
select lives_ok(
  format($f$delete from public.company_invites where id = '%s'$f$, (select invite_id from rls_ctx)),
  'Manager can hard-delete invite'
);

-- 47 revoked not redeemable
select tests.clear_auth();
do $$
declare tok text;
begin
  tok := tests.mint_invite(
    (select company_a from rls_ctx), 'rev2@x.com', 'freelancer',
    'cccccccc-cccc-cccc-cccc-ccccccccccc1', null, now() + interval '1 day', now()
  );
  update rls_ctx set invite_a = tok;
end $$;
select tests.authenticate_as('cccccccc-cccc-cccc-cccc-ccccccccccc5');
select throws_ok(
  format($f$select public.accept_company_invite('%s')$f$, (select invite_a from rls_ctx)),
  'P0001',
  'This invite has been revoked',
  'Revoked invite not redeemable'
);

-- 48 email mismatch still redeemable
select tests.clear_auth();
do $$
declare tok text;
begin
  tok := tests.mint_invite(
    (select company_a from rls_ctx), 'someone-else@x.com', 'freelancer',
    'cccccccc-cccc-cccc-cccc-ccccccccccc1'
  );
  update rls_ctx set invite_a = tok;
end $$;
select tests.authenticate_as('cccccccc-cccc-cccc-cccc-ccccccccccc5');
select lives_ok(
  format($f$select public.accept_company_invite('%s')$f$, (select invite_a from rls_ctx)),
  'Email mismatch still redeemable (documented)'
);

-- 60–61 RLS enabled
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'company_invites'),
  'RLS enabled on company_invites'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'company_members'),
  'RLS enabled on company_members'
);

select * from finish();
rollback;
