-- ============================================================================
-- Storage buckets for profile avatars and company logos.
--
-- Both are public-read (so image URLs render without a signed request). Writes
-- are scoped by the first path segment:
--   avatars/{user_id}/...        — a user may write only their own folder
--   company-logos/{company_id}/… — company managers may write their company's folder
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

-- ── Avatars ──────────────────────────────────────────────────────────────────
create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ── Company logos ────────────────────────────────────────────────────────────
create policy "company logos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'company-logos');

create policy "managers write their company logo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'company-logos'
    and public.is_company_manager(((storage.foldername(name))[1])::uuid)
  );

create policy "managers update their company logo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'company-logos'
    and public.is_company_manager(((storage.foldername(name))[1])::uuid)
  );

create policy "managers delete their company logo"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'company-logos'
    and public.is_company_manager(((storage.foldername(name))[1])::uuid)
  );
