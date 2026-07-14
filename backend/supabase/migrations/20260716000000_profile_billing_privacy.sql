-- ============================================================================
-- Profile billing privacy
--
-- A freelancer's legal identity — billing address, VAT number, business/registry
-- id — previously lived on `public.profiles`, whose SELECT policy is
-- "self OR shares_company_with(user_id)". That made every teammate able to read
-- every other member's address and tax ids: those columns are only ever needed
-- by the person themselves (Settings) and by a manager rendering their invoice.
--
-- RLS is row-level, not column-level, so the only way to keep names/avatars
-- visible to peers while restricting the legal details to self + managers is to
-- move the legal columns into their own table with a tighter policy.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: is the caller a manager/admin in a company they share with `target`?
-- SECURITY DEFINER so the policy can see both membership rows regardless of the
-- caller's own RLS. Mirrors shares_company_with, but only the caller side must
-- be elevated.
-- ----------------------------------------------------------------------------
create or replace function public.manages_member(target uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.company_members me
    join public.company_members them on them.company_id = me.company_id
    where me.user_id = (select auth.uid())
      and me.role in ('manager', 'admin')
      and me.deleted = false
      and them.user_id = target
      and them.deleted = false
  );
$$;

-- ----------------------------------------------------------------------------
-- profile_billing — one row per user, holding the private legal details.
-- ----------------------------------------------------------------------------
create table public.profile_billing (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  address     text,
  vat_id      text,   -- VAT registration number (e.g. FR..)
  business_id text,   -- freelancer's business/registry id (e.g. SIRET)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false
);

alter table public.profile_billing enable row level security;

-- Readable by the owner and by a manager/admin who shares a company with them
-- (managers issue/settle invoices, which carry these legal details). Never by an
-- ordinary peer.
create policy "billing readable to self and managers"
  on public.profile_billing for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.manages_member(user_id)
  );

-- Only the owner writes their own billing details.
create policy "users insert their own billing"
  on public.profile_billing for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "users update their own billing"
  on public.profile_billing for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger set_profile_billing_updated_at
  before update on public.profile_billing
  for each row execute function public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Migrate existing legal details off profiles, then drop the exposed columns.
-- ----------------------------------------------------------------------------
insert into public.profile_billing (user_id, address, vat_id, business_id)
select user_id, address, vat_id, business_id
from public.profiles
where address is not null or vat_id is not null or business_id is not null
on conflict (user_id) do nothing;

alter table public.profiles
  drop column address,
  drop column vat_id,
  drop column business_id;
