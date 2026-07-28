-- Allow redeeming admin-role company invites.
--
-- accept_company_invite inserts company_members as the invitee. enforce_role_change_rules
-- previously required auth.uid() to already be a company admin before inserting role=admin,
-- so admin invites always failed once the company had members.
--
-- Fix: an ungranted SECURITY DEFINER helper performs the insert with a local
-- chrono.accepting_invite GUC. enforce_role_change_rules allows admin-tier INSERT only
-- when that GUC is on (UPDATE still fully guarded). Clients cannot call the helper;
-- RLS still blocks non-admin direct INSERT of admin rows even if a client sets the GUC.

create or replace function public.enforce_role_change_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Invite redeem path: allow admin-tier INSERT only (not UPDATE).
  if tg_op = 'INSERT'
     and current_setting('chrono.accepting_invite', true) = 'on' then
    return new;
  end if;

  -- (b) admin-tier changes require an existing admin (except the bootstrap row).
  if (new.role = 'admin'
      or (tg_op = 'UPDATE' and old.role = 'admin' and new.role is distinct from old.role))
     and not public.is_company_admin(new.company_id)
     and exists (
       select 1 from public.company_members cm
       where cm.company_id = new.company_id and cm.id is distinct from new.id
     ) then
    raise exception 'Only an admin can grant or change the admin role';
  end if;

  -- (a) no self-escalation.
  if tg_op = 'UPDATE'
     and new.role is distinct from old.role
     and new.user_id = (select auth.uid())
     and not public.is_company_admin(new.company_id) then
    raise exception 'Only an admin can change your role';
  end if;

  return new;
end;
$$;

-- Internal insert used only by accept_company_invite. Not granted to authenticated/anon.
create or replace function public.internal_insert_member_from_invite(
  p_company_id uuid,
  p_user_id uuid,
  p_role public.app_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('chrono.accepting_invite', 'on', true);
  begin
    insert into public.company_members (company_id, user_id, role)
    values (p_company_id, p_user_id, p_role)
    on conflict (company_id, user_id) do nothing;
  exception
    when others then
      perform set_config('chrono.accepting_invite', 'off', true);
      raise;
  end;
  perform set_config('chrono.accepting_invite', 'off', true);
end;
$$;

-- Revoke any default PUBLIC grants; never grant to authenticated/anon.
revoke all on function public.internal_insert_member_from_invite(uuid, uuid, public.app_role) from public;
revoke all on function public.internal_insert_member_from_invite(uuid, uuid, public.app_role) from anon, authenticated;

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
