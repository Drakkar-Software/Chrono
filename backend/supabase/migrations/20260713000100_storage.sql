-- ============================================================================
-- Storage buckets for profile avatars and company logos.
--
-- Both are public-read (so image URLs render without a signed request). Writes
-- are scoped by the first path segment:
--   avatars/{user_id}/...        — a user may write only their own folder
--   company-logos/{company_id}/… — company managers may write their company's folder
-- ============================================================================

-- Public buckets, but restricted to raster image types (NO image/svg+xml — an
-- SVG served from a public URL can execute script) and capped at 2 MB. The
-- bucket-level allow-list is the only SERVER-side content enforcement; never
-- trust the client-supplied content-type.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('company-logos', 'company-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

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
