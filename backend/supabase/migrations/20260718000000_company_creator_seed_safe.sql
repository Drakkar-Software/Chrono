-- ============================================================================
-- Make set_company_creator() seed-/service-safe
--
-- 20260717 stamped companies.created_by = auth.uid() unconditionally. In a
-- service or seed context there is no session, so auth.uid() is NULL — the
-- trigger nulled created_by and handle_new_company() then skipped the admin
-- bootstrap, leaving programmatically-created companies (seed.sql demo data,
-- admin tooling) with no members. Only override when a session exists; keep the
-- supplied created_by otherwise. Authenticated callers are still forced to
-- themselves, so the anti-spoof guarantee is unchanged.
-- ============================================================================
create or replace function public.set_company_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_by := coalesce((select auth.uid()), new.created_by);
  return new;
end;
$$;
