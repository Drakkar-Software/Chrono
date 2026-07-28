-- If an invite is already marked accepted but the caller is an active member of
-- that company, treat accept as success. Covers: soft-delete revive races,
-- null accepted_by, and onboarding retries after a prior partial join.
--
-- Errors are raised as stable slugs, never user-facing copy: the client maps
-- them to a translated message (see classifyInviteError in @chrono/sdk).

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
    raise exception 'invite-unsigned';
  end if;

  if v_token is null then
    raise exception 'invite-not-found';
  end if;

  select * into v_invite
  from public.company_invites
  where token = v_token
  for update;

  if v_invite.id is null then
    raise exception 'invite-not-found';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'invite-revoked';
  end if;
  if v_invite.accepted_at is not null then
    if v_invite.accepted_by is not distinct from v_uid
       or exists (
         select 1
         from public.company_members cm
         where cm.company_id = v_invite.company_id
           and cm.user_id = v_uid
           and cm.deleted = false
       ) then
      perform public.internal_insert_member_from_invite(
        v_invite.company_id,
        v_uid,
        v_invite.role
      );
      -- Ensure accepted_by is stamped when reclaiming a used invite as a member.
      if v_invite.accepted_by is null then
        update public.company_invites
        set accepted_by = v_uid, updated_at = now()
        where id = v_invite.id;
      end if;
      return v_invite.company_id;
    end if;
    raise exception 'invite-used';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'invite-expired';
  end if;

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
