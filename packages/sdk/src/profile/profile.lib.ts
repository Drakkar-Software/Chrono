import type { Profile } from './profile.entity';

/** Human-facing name for a profile, falling back to a placeholder. */
export function displayName(
  profile: Pick<Profile, 'full_name'> | null | undefined,
  fallback = 'Unnamed',
): string {
  const name = profile?.full_name?.trim();
  return name && name.length > 0 ? name : fallback;
}
