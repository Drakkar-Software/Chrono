import type { Profile, ProfileBilling } from './profile.entity';

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

/**
 * Legal identity for a freelancer (invoice "from" block). The name comes from
 * the public profile; the address/tax ids come from the private billing row
 * (readable only by the freelancer themselves and by their managers).
 */
export function freelancerLegal(
  profile: Pick<Profile, 'full_name'> | null | undefined,
  billing: Pick<ProfileBilling, 'address' | 'vat_id' | 'business_id'> | null | undefined,
): FreelancerLegal {
  return {
    name: displayName(profile),
    address: billing?.address ?? null,
    vatId: billing?.vat_id ?? null,
    businessId: billing?.business_id ?? null,
  };
}
