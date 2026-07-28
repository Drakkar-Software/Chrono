-- Make accept_company_invite idempotent for the same acceptor.
--
-- Onboarding calls accept then completeOnboarding. If accept succeeds (member +
-- accepted_at) but a later step fails or the user retries, the old check raised
-- "already been used" and left them stuck on the join form while already a member.
-- Re-accept by the same accepted_by is a no-op success; other users still blocked.

create or replace function public.accept_company_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.company_invites;
  v_uid uuid := (select auth.uid());
  v_token text := nullif(btrim(p_token), '');
begin
  if v_uid is null then
    raise exception 'Must be signed in to accept an invite';
  end if;

  if v_token is null then
    raise exception 'Invite not found';
  end if;

  select * into v_invite
  from public.company_invites
  where token = v_token
  for update;

  if v_invite.id is null then
    raise exception 'Invite not found';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'This invite has been revoked';
  end if;
  if v_invite.accepted_at is not null then
    if v_invite.accepted_by is not distinct from v_uid then
      -- Same user retrying after a partial onboarding: ensure membership, succeed.
      perform public.internal_insert_member_from_invite(
        v_invite.company_id,
        v_uid,
        v_invite.role
      );
      return v_invite.company_id;
    end if;
    raise exception 'This invite has already been used';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invite has expired';
  end if;

  -- Join at the invited role (or keep an existing membership on conflict).
  perform public.internal_insert_member_from_invite(
    v_invite.company_id,
    v_uid,
    v_invite.role
  );

  update public.company_invites
  set accepted_at = now(), accepted_by = v_uid, updated_at = now()
  where id = v_invite.id;

  return v_invite.company_id;
end;
$$;

revoke all on function public.accept_company_invite(text) from public;
revoke all on function public.accept_company_invite(text) from anon;
grant execute on function public.accept_company_invite(text) to authenticated;
