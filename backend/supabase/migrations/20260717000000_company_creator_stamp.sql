-- ============================================================================
-- Fix company creation (onboarding) + stamp created_by server-side
--
-- Creating a company via the app failed with "new row violates row-level
-- security policy for table companies". Two causes, both fixed here:
--
--  1. The old INSERT policy required `created_by = auth.uid()`, trusting the
--     client to send its own id. The offline write layer omits/nulls it, so the
--     row arrived with created_by = NULL and the check failed. Fix: stamp
--     created_by from the session in a BEFORE trigger (also removes a spoof
--     surface — a client can no longer claim another user as creator) and gate
--     the INSERT on identity only.
--
--  2. The client insert uses RETURNING (`.insert().select()`), whose SELECT
--     policy `is_company_member(id)` is evaluated BEFORE the AFTER-INSERT
--     trigger (handle_new_company) adds the creator's membership — so the
--     creator can't read the row it just made and the statement fails. Fix: let
--     the creator read their own company by `created_by` too.
-- ============================================================================

-- Stamp the creator authoritatively (never trust / never require the client).
create or replace function public.set_company_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_by := (select auth.uid());
  return new;
end;
$$;

drop trigger if exists set_company_creator on public.companies;
create trigger set_company_creator
  before insert on public.companies
  for each row execute function public.set_company_creator();

-- Identity-only INSERT check; created_by is enforced by the trigger above.
drop policy if exists "authenticated users create companies" on public.companies;
create policy "authenticated users create companies"
  on public.companies for insert to authenticated
  with check ((select auth.uid()) is not null);

-- Read own company by membership OR by being its (server-stamped) creator, so
-- INSERT ... RETURNING succeeds before the membership-creating AFTER trigger runs.
drop policy if exists "members read their companies" on public.companies;
create policy "members read their companies"
  on public.companies for select to authenticated
  using (public.is_company_member(id) or created_by = (select auth.uid()));
