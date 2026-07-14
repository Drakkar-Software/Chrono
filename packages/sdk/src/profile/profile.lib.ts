import type { Profile } from './profile.entity';

/** Human-facing name for a profile, falling back to a placeholder. */
export function displayName(
  profile: Pick<Profile, 'full_name'> | null | undefined,
  fallback = 'Unnamed',
): string {
  const name = profile?.full_name?.trim();
  return name && name.length > 0 ? name : fallback;
}

export type FreelancerLegal = {
  name: string;
  address: string | null;
  vatId: string | null;
  businessId: string | null;
};

/** Legal identity for a freelancer (invoice "from" block). */
export function freelancerLegal(
  profile: Pick<Profile, 'full_name' | 'address' | 'vat_id' | 'business_id'> | null | undefined,
): FreelancerLegal {
  return {
    name: displayName(profile),
    address: profile?.address ?? null,
    vatId: profile?.vat_id ?? null,
    businessId: profile?.business_id ?? null,
  };
}
