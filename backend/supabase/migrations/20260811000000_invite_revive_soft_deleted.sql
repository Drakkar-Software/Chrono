-- Invite accept: revive soft-deleted memberships; seat check ignores an
-- already-active seat holder (ON CONFLICT re-insert / idempotent re-accept).

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
    on conflict (company_id, user_id) do update
      set
        -- Soft-deleted members must become active again on re-invite.
        deleted = false,
        -- Keep an active member's role; apply invite role only when undeleting.
        role = case
          when company_members.deleted then excluded.role
          else company_members.role
        end,
        updated_at = now();
  exception
    when others then
      perform set_config('chrono.accepting_invite', 'off', true);
      raise;
  end;
  perform set_config('chrono.accepting_invite', 'off', true);
end;
$$;

revoke all on function public.internal_insert_member_from_invite(uuid, uuid, public.app_role) from public;
revoke all on function public.internal_insert_member_from_invite(uuid, uuid, public.app_role) from anon, authenticated;

create or replace function public.enforce_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  if new.deleted then
    return new;
  end if;

  -- Already holding an active seat (idempotent accept / ON CONFLICT): not a new seat.
  if exists (
    select 1
    from public.company_members cm
    where cm.company_id = new.company_id
      and cm.user_id = new.user_id
      and cm.deleted = false
  ) then
    return new;
  end if;

  select seat_limit into v_limit
  from public.company_subscriptions
  where company_id = new.company_id;

  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count
  from public.company_members
  where company_id = new.company_id and deleted = false;

  if v_count >= v_limit then
    raise exception 'Company has reached its seat limit (%) for the current plan', v_limit;
  end if;

  return new;
end;
$$;
