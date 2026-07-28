begin;
select plan(10);

select tests.create_auth_user('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'edge-admin@test.local');
select tests.create_auth_user('dddddddd-dddd-dddd-dddd-ddddddddddd2', 'edge-free@test.local');
select tests.create_auth_user('dddddddd-dddd-dddd-dddd-ddddddddddd3', 'edge-u1@test.local');
select tests.create_auth_user('dddddddd-dddd-dddd-dddd-ddddddddddd4', 'edge-u2@test.local');
select tests.create_auth_user('dddddddd-dddd-dddd-dddd-ddddddddddd5', 'edge-u3@test.local');

select tests.clear_auth();

create temporary table edge_ctx (
  company_id uuid,
  seat_co uuid,
  tok text,
  tok2 text
) on commit drop;
grant all on table edge_ctx to authenticated, anon;

do $$
declare
  v_co uuid;
  v_seat uuid;
begin
  v_co := tests.make_company('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'edge-' || gen_random_uuid()::text);
  perform tests.add_member(v_co, 'dddddddd-dddd-dddd-dddd-ddddddddddd2', 'freelancer');
  v_seat := tests.make_company('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'seat-' || gen_random_uuid()::text);
  update public.company_subscriptions set seat_limit = 2 where company_id = v_seat;
  insert into edge_ctx(company_id, seat_co) values (v_co, v_seat);
end $$;

-- 49 existing member redeems admin invite: role unchanged, invite accepted
do $$
declare v_tok text;
begin
  v_tok := tests.mint_invite(
    (select company_id from edge_ctx), 'upgrade@x.com', 'admin',
    'dddddddd-dddd-dddd-dddd-ddddddddddd1'
  );
  update edge_ctx set tok = v_tok;
end $$;
select tests.authenticate_as('dddddddd-dddd-dddd-dddd-ddddddddddd2');
select lives_ok(
  format($f$select public.accept_company_invite('%s')$f$, (select tok from edge_ctx)),
  'Existing member can redeem invite (ON CONFLICT DO NOTHING)'
);
select is(
  (select role::text from public.company_members
   where company_id = (select company_id from edge_ctx)
     and user_id = 'dddddddd-dddd-dddd-dddd-ddddddddddd2'),
  'freelancer',
  'Existing member role not upgraded on conflict'
);
select tests.clear_auth();
select ok(
  (select accepted_at is not null from public.company_invites where token = (select tok from edge_ctx)),
  'Invite still marked accepted on conflict'
);

-- 50 soft-deleted member redeeming again — unique conflict keeps deleted row
select tests.clear_auth();
update public.company_members
set deleted = true
where company_id = (select company_id from edge_ctx)
  and user_id = 'dddddddd-dddd-dddd-dddd-ddddddddddd2';
do $$
declare v_tok text;
begin
  v_tok := tests.mint_invite(
    (select company_id from edge_ctx), 'rejoin@x.com', 'freelancer',
    'dddddddd-dddd-dddd-dddd-ddddddddddd1'
  );
  update edge_ctx set tok = v_tok;
end $$;
select tests.authenticate_as('dddddddd-dddd-dddd-dddd-ddddddddddd2');
select lives_ok(
  format($f$select public.accept_company_invite('%s')$f$, (select tok from edge_ctx)),
  'Soft-deleted member redeem does not error'
);
select tests.clear_auth();
select ok(
  (select deleted from public.company_members
   where company_id = (select company_id from edge_ctx)
     and user_id = 'dddddddd-dddd-dddd-dddd-ddddddddddd2'),
  'Soft-deleted member stays deleted on conflict (documented)'
);

-- 51 seat limit: accept fails and invite remains unaccepted
select tests.clear_auth();
do $$
declare v_tok1 text;
begin
  perform tests.add_member((select seat_co from edge_ctx), 'dddddddd-dddd-dddd-dddd-ddddddddddd3', 'freelancer');
  v_tok1 := tests.mint_invite(
    (select seat_co from edge_ctx), 'full1@x.com', 'freelancer',
    'dddddddd-dddd-dddd-dddd-ddddddddddd1'
  );
  update edge_ctx set tok = v_tok1;
end $$;
select tests.authenticate_as('dddddddd-dddd-dddd-dddd-ddddddddddd4');
select throws_like(
  format($f$select public.accept_company_invite('%s')$f$, (select tok from edge_ctx)),
  '%seat limit%',
  'Accept fails at seat limit'
);
select tests.clear_auth();
select ok(
  (select accepted_at is null from public.company_invites where token = (select tok from edge_ctx)),
  'Failed accept does not mark invite accepted (atomicity)'
);

-- 52 under limit succeeds — raise seat_limit and accept
select tests.clear_auth();
update public.company_subscriptions set seat_limit = 10 where company_id = (select seat_co from edge_ctx);
do $$
declare v_tok text;
begin
  v_tok := tests.mint_invite(
    (select seat_co from edge_ctx), 'ok-seat@x.com', 'freelancer',
    'dddddddd-dddd-dddd-dddd-ddddddddddd1'
  );
  update edge_ctx set tok = v_tok;
end $$;
select tests.authenticate_as('dddddddd-dddd-dddd-dddd-ddddddddddd4');
select lives_ok(
  format($f$select public.accept_company_invite('%s')$f$, (select tok from edge_ctx)),
  'Accept succeeds under seat limit'
);

-- 53 last seat: one of two competing accepts fails
select tests.clear_auth();
update public.company_subscriptions set seat_limit = (
  select count(*)::int from public.company_members
  where company_id = (select seat_co from edge_ctx) and deleted = false
) + 1
where company_id = (select seat_co from edge_ctx);
do $$
declare v_t1 text; v_t2 text;
begin
  v_t1 := tests.mint_invite(
    (select seat_co from edge_ctx), 'race1@x.com', 'freelancer',
    'dddddddd-dddd-dddd-dddd-ddddddddddd1'
  );
  v_t2 := tests.mint_invite(
    (select seat_co from edge_ctx), 'race2@x.com', 'freelancer',
    'dddddddd-dddd-dddd-dddd-ddddddddddd1'
  );
  update edge_ctx set tok = v_t1, tok2 = v_t2;
end $$;
select tests.authenticate_as('dddddddd-dddd-dddd-dddd-ddddddddddd5');
select lives_ok(
  format($f$select public.accept_company_invite('%s')$f$, (select tok from edge_ctx)),
  'First of two last-seat accepts succeeds'
);
select tests.authenticate_as('dddddddd-dddd-dddd-dddd-ddddddddddd2');
select throws_like(
  format($f$select public.accept_company_invite('%s')$f$, (select tok2 from edge_ctx)),
  '%seat limit%',
  'Second last-seat accept fails'
);

select * from finish();
rollback;
