-- ============================================================================
-- Foreign keys to profiles so PostgREST can embed profile data
--
-- The client embeds the author profile on several resources, e.g.
--   invoices?select=...,freelancer:profiles(full_name)
-- but freelancer_id / user_id reference auth.users (not in the exposed schema),
-- so PostgREST can't resolve the relationship and returns PGRST200
-- ("Could not find a relationship between 'invoices' and 'profiles'").
--
-- Add a second FK from each embedded column to profiles(user_id) (its PK, and
-- every auth user has a profile via handle_new_user), giving PostgREST an
-- embeddable relationship. Kept alongside the existing auth.users FK; cascades
-- match the auth.users → profiles → child cascade so deletes stay consistent.
-- ============================================================================

alter table public.invoices
  add constraint invoices_freelancer_profile_fkey
  foreign key (freelancer_id) references public.profiles (user_id) on delete cascade;

alter table public.company_members
  add constraint company_members_user_profile_fkey
  foreign key (user_id) references public.profiles (user_id) on delete cascade;

alter table public.project_members
  add constraint project_members_user_profile_fkey
  foreign key (user_id) references public.profiles (user_id) on delete cascade;

alter table public.project_referrals
  add constraint project_referrals_user_profile_fkey
  foreign key (user_id) references public.profiles (user_id) on delete cascade;
