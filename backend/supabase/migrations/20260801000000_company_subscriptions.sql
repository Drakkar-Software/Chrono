-- ============================================================================
-- Chrono Pro — company subscriptions
--
-- One row per company holding the RevenueCat-synced billing state (written by
-- the revenuecat-webhook edge function via the service role, which bypasses
-- RLS — there are deliberately no authenticated insert/update/delete
-- policies here). Every company starts on a 30-day trial at creation time.
-- Seat = a non-deleted company_members row; enforced server-side below.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Start Company Subscriptions
-- ----------------------------------------------------------------------------
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'expired');
create type public.subscription_plan as enum ('trial', 'solo', 'team', 'scale');

create table public.company_subscriptions (
  company_id           uuid primary key references public.companies (id) on delete cascade,
  status                subscription_status not null default 'trialing',
  plan                  subscription_plan not null default 'trial',
  seat_limit            integer not null default 25 check (seat_limit > 0),
  store                 text,   -- 'app_store' | 'play_store' | 'stripe' | 'test_store' | null while trialing
  rc_app_user_id        text,
  trial_ends_at         timestamptz,
  current_period_end    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.company_subscriptions enable row level security;

create policy "members read their company's subscription"
  on public.company_subscriptions for select to authenticated
  using (public.is_company_member(company_id));

create trigger set_company_subscriptions_updated_at
  before update on public.company_subscriptions
  for each row execute function public.update_updated_at_column();

-- Every new company starts a 30-day, no-card trial with the top seat limit.
create or replace function public.handle_new_company_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.company_subscriptions (company_id, status, plan, seat_limit, trial_ends_at)
  values (new.id, 'trialing', 'trial', 25, now() + interval '30 days')
  on conflict (company_id) do nothing;
  return new;
end;
$$;

create trigger on_company_created_start_trial
  after insert on public.companies
  for each row execute function public.handle_new_company_subscription();

-- Hard seat-cap enforcement: reject a new active member once the company is
-- already at its plan's seat_limit. The client also checks this for UX, but
-- this is the source of truth. A company with no subscription row yet (should
-- not happen once the trial trigger above runs) is left unblocked.
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

create trigger enforce_seat_limit_trigger
  before insert on public.company_members
  for each row execute function public.enforce_seat_limit();
-- End Company Subscriptions
