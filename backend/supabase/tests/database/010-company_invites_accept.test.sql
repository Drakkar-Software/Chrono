begin;
select plan(24);

-- Happy path + lifecycle for accept_company_invite
select tests.create_auth_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'admin1@test.local');
select tests.create_auth_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'invitee-admin@test.local');
select tests.create_auth_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'invitee-mgr@test.local');
select tests.create_auth_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'invitee-free@test.local');
select tests.create_auth_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'other-co-admin@test.local');
select tests.create_auth_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', 'second-redeemer@test.local');
-- aaa6 must never join the company: it is the "outsider" probe for the
-- used-invite guards. Redeeming an invite as aaa6 would make it a member, and
-- accept_company_invite treats an active member re-redeeming a used invite as
-- success (20260812000000), so the guard would stop being exercised. The
-- happy-path redemptions below therefore get their own throwaway users.
select tests.create_auth_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7', 'pad-redeemer@test.local');
select tests.create_auth_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8', 'boundary-redeemer@test.local');

select tests.clear_auth();

create temporary table inv_ctx (
  company_id uuid,
  other_company uuid,
  tok_admin text,
  tok_mgr text,
  tok_free text,
  tok_revoked text,
  tok_used text,
  tok_expired text,
  tok_rev_exp text,
  tok_pad text,
  tok_boundary text
) on commit drop;
grant all on table inv_ctx to authenticated, anon;

do $$
declare
  v_co uuid;
  v_other uuid;
begin
  v_co := tests.make_company('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'inv-accept-' || gen_random_uuid()::text);
  v_other := tests.make_company('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'inv-other-' || gen_random_uuid()::text);
  insert into inv_ctx(company_id, other_company) values (v_co, v_other);

  update inv_ctx set
    tok_admin = tests.mint_invite(v_co, 'a@x.com', 'admin', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
    tok_mgr = tests.mint_invite(v_co, 'm@x.com', 'manager', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
    tok_free = tests.mint_invite(v_co, 'f@x.com', 'freelancer', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
    tok_revoked = tests.mint_invite(v_co, 'r@x.com', 'freelancer', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', null, now() + interval '1 day', now()),
    tok_used = tests.mint_invite(v_co, 'u@x.com', 'freelancer', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', null, now() + interval '1 day', null, now(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
    tok_expired = tests.mint_invite(v_co, 'e@x.com', 'freelancer', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', null, now() - interval '1 day'),
    tok_rev_exp = tests.mint_invite(v_co, 're@x.com', 'freelancer', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', null, now() - interval '1 day', now()),
    tok_pad = tests.mint_invite(v_co, 'pad@x.com', 'freelancer', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
    tok_boundary = tests.mint_invite(v_co, 'b@x.com', 'freelancer', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', null, now());
end $$;

-- 1 admin invite accept
select tests.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2');
select is(
  public.accept_company_invite((select tok_admin from inv_ctx)),
  (select company_id from inv_ctx),
  'admin invite accept returns company_id'
);
select is(
  (select role::text from public.company_members
   where company_id = (select company_id from inv_ctx)
     and user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'),
  'admin',
  'invitee becomes admin'
);
select ok(
  (select accepted_at is not null and accepted_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
   from public.company_invites where token = (select tok_admin from inv_ctx)),
  'admin invite marked accepted'
);
select ok(public.is_company_admin((select company_id from inv_ctx)), 'invitee passes is_company_admin');

-- 2 manager invite
select tests.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3');
select lives_ok(
  $$select public.accept_company_invite((select tok_mgr from inv_ctx))$$,
  'manager invite accepts'
);
select is(
  (select role::text from public.company_members
   where company_id = (select company_id from inv_ctx)
     and user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'),
  'manager',
  'invitee becomes manager'
);

-- 3 freelancer invite
select tests.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4');
select lives_ok(
  $$select public.accept_company_invite((select tok_free from inv_ctx))$$,
  'freelancer invite accepts'
);
select is(
  (select role::text from public.company_members
   where company_id = (select company_id from inv_ctx)
     and user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'),
  'freelancer',
  'invitee becomes freelancer'
);

-- 4 multi-company: user already admin elsewhere
select tests.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5');
select is(
  public.accept_company_invite(
    tests.mint_invite(
      (select company_id from inv_ctx), 'x@x.com', 'freelancer',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
    )
  ),
  (select company_id from inv_ctx),
  'multi-company user joins correct company'
);

-- 6–8 unknown / empty / whitespace
select tests.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6');
select throws_ok(
  $$select public.accept_company_invite('not-a-real-token')$$,
  'P0001',
  'invite-not-found',
  'unknown token'
);
select throws_ok(
  $$select public.accept_company_invite('')$$,
  'P0001',
  'invite-not-found',
  'empty token'
);
select throws_ok(
  $$select public.accept_company_invite('   ')$$,
  'P0001',
  'invite-not-found',
  'whitespace-only token'
);

-- 9 padded token is accepted after server trim
select tests.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7');
select lives_ok(
  format($f$select public.accept_company_invite('  %s  ')$f$, (select tok_pad from inv_ctx)),
  'padded token accepted via server trim'
);

-- 10–15 lifecycle guards, run as the outsider so `invite-used` is reachable
select tests.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6');
select throws_ok(
  format($f$select public.accept_company_invite('%s')$f$, (select tok_revoked from inv_ctx)),
  'P0001',
  'invite-revoked',
  'revoked invite'
);
select throws_ok(
  format($f$select public.accept_company_invite('%s')$f$, (select tok_used from inv_ctx)),
  'P0001',
  'invite-used',
  'already used invite'
);
select throws_ok(
  format($f$select public.accept_company_invite('%s')$f$, (select tok_expired from inv_ctx)),
  'P0001',
  'invite-expired',
  'expired invite'
);
select throws_ok(
  format($f$select public.accept_company_invite('%s')$f$, (select tok_rev_exp from inv_ctx)),
  'P0001',
  'invite-revoked',
  'revoked+expired reports revoked first'
);

-- 13 boundary: expires_at = now() is still valid (< now() required to expire)
select tests.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8');
select lives_ok(
  format($f$select public.accept_company_invite('%s')$f$, (select tok_boundary from inv_ctx)),
  'expires_at = now() still redeemable'
);

-- 16 unsigned (jwt cleared, still able to EXECUTE as postgres → auth.uid null)
select tests.clear_auth();
select throws_ok(
  $$select public.accept_company_invite('anything')$$,
  'P0001',
  'invite-unsigned',
  'unsigned cannot accept'
);

-- 17 anon cannot execute accept
select ok(
  not has_function_privilege('anon', 'public.accept_company_invite(text)', 'execute'),
  'anon cannot execute accept_company_invite'
);

-- 18 second user cannot reuse admin token
select tests.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6');
select throws_ok(
  format($f$select public.accept_company_invite('%s')$f$, (select tok_admin from inv_ctx)),
  'P0001',
  'invite-used',
  'second user cannot reuse token'
);

-- 19 same acceptor can redeem again (idempotent; onboarding retry)
select tests.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2');
select is(
  public.accept_company_invite((select tok_admin from inv_ctx)),
  (select company_id from inv_ctx),
  'same acceptor redeem is idempotent'
);

-- 20–21 a different active member may re-redeem a used invite (the branch added
-- in 20260812000000), but it must not inherit that invite's role. aaa7 joined as
-- a freelancer via tok_pad; tok_admin is a used ADMIN invite.
select tests.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7');
select is(
  public.accept_company_invite((select tok_admin from inv_ctx)),
  (select company_id from inv_ctx),
  'active member re-redeeming a used invite succeeds'
);
select is(
  (select role::text from public.company_members
   where company_id = (select company_id from inv_ctx)
     and user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7'),
  'freelancer',
  'a used admin invite cannot escalate an existing member'
);

select * from finish();
rollback;
