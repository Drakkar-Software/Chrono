-- Explicit correction time entries: signed duration_minutes (≠ 0).
-- Negatives offset approved/locked rows without rewriting history.
-- Guard: net minutes per (user, project, calendar month) must stay ≥ 0.

alter table public.time_entries
  drop constraint if exists time_entries_duration_minutes_check;

alter table public.time_entries
  add constraint time_entries_duration_minutes_check
  check (duration_minutes <> 0);

comment on column public.time_entries.duration_minutes is
  'Worked minutes; may be negative for an explicit correction that offsets prior time.';

create or replace function public.enforce_time_entry_month_net_non_negative()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_project uuid;
  v_month date;
  v_others integer;
  v_self integer;
begin
  if tg_op = 'DELETE' then
    v_user := old.user_id;
    v_project := old.project_id;
    v_month := date_trunc('month', old.entry_date)::date;
    select coalesce(sum(te.duration_minutes), 0)
      into v_others
    from public.time_entries te
    where te.user_id = v_user
      and te.project_id = v_project
      and te.deleted = false
      and date_trunc('month', te.entry_date)::date = v_month
      and te.id is distinct from old.id;
    if v_others < 0 then
      raise exception
        'Deleting this entry would make net time negative for this project month (remaining %)',
        v_others;
    end if;
    return old;
  end if;

  v_user := new.user_id;
  v_project := new.project_id;
  v_month := date_trunc('month', new.entry_date)::date;

  -- Soft-delete: exclude this row from the net (same as hard delete).
  if coalesce(new.deleted, false) then
    select coalesce(sum(te.duration_minutes), 0)
      into v_others
    from public.time_entries te
    where te.user_id = v_user
      and te.project_id = v_project
      and te.deleted = false
      and date_trunc('month', te.entry_date)::date = v_month
      and te.id is distinct from new.id;
    if v_others < 0 then
      raise exception
        'Removing this entry would make net time negative for this project month (remaining %)',
        v_others;
    end if;
    return new;
  end if;

  v_self := new.duration_minutes;

  select coalesce(sum(te.duration_minutes), 0)
    into v_others
  from public.time_entries te
  where te.user_id = v_user
    and te.project_id = v_project
    and te.deleted = false
    and date_trunc('month', te.entry_date)::date = v_month
    and te.id is distinct from new.id;

  if v_others + v_self < 0 then
    raise exception
      'Correction would make net time negative for this project month (others %, self %)',
      v_others, v_self;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_time_entry_month_net_non_negative_trigger on public.time_entries;
create trigger enforce_time_entry_month_net_non_negative_trigger
  before insert or update or delete on public.time_entries
  for each row execute function public.enforce_time_entry_month_net_non_negative();
