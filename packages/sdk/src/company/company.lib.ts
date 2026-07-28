import { DEFAULT_CURRENCY } from '../constants';
import type { Company } from './company.entity';

type CompanyContent = { name?: string; logo_url?: string };

/** Display name pulled from the company's JSON content, with a fallback. */
export function companyName(
  company: Pick<Company, 'content' | 'slug'> | null | undefined,
  fallback = 'Company',
): string {
  const content = (company?.content ?? {}) as CompanyContent;
  const name = content.name?.trim();
  if (name && name.length > 0) return name;
  const slug = company?.slug?.trim();
  return slug && slug.length > 0 ? slug : fallback;
}

/**
 * Stable display order for a user's memberships. `fetchMyCompanies` reads
 * `company_members` with no ORDER BY, so Postgres may return a different order
 * on every load — which would reshuffle the sidebar's company switcher and the
 * settings picker between refreshes, and make "fall back to the first company"
 * pick an arbitrary one. Sort by display name, tie-broken by id so the order is
 * total and deterministic.
 */
export function sortCompaniesByName<T extends Pick<Company, 'id' | 'content' | 'slug'>>(
  companies: readonly T[],
): T[] {
  return [...companies].sort(
    (a, b) =>
      companyName(a).localeCompare(companyName(b), undefined, { sensitivity: 'base' }) ||
      a.id.localeCompare(b.id),
  );
}

/** The company's currency, defaulting when unset. */
export function companyCurrency(
  company: Pick<Company, 'currency'> | null | undefined,
): string {
  const currency = company?.currency?.trim();
  return currency && currency.length > 0 ? currency : DEFAULT_CURRENCY;
}

/** The company's default VAT rate (percentage), or null for no VAT. */
export function companyVatRate(
  company: Pick<Company, 'vat_rate'> | null | undefined,
): number | null {
  return company?.vat_rate ?? null;
}

export type LegalParty = {
  name: string;
  address: string | null;
  vatId: string | null;
  registrationId: string | null;
};

/** Legal identity for the company (invoice "from"/"bill-to" block). */
export function companyLegal(
  company:
    | (Pick<Company, 'content' | 'slug' | 'legal_name' | 'address' | 'vat_id' | 'registration_id'>)
    | null
    | undefined,
): LegalParty {
  return {
    name: company?.legal_name?.trim() || companyName(company),
    address: company?.address ?? null,
    vatId: company?.vat_id ?? null,
    registrationId: company?.registration_id ?? null,
  };
}

/** Whether the company has enough legal detail to render on an invoice. */
export function hasLegalDetails(
  company: Pick<Company, 'address' | 'vat_id' | 'registration_id'> | null | undefined,
): boolean {
  return Boolean(company?.address || company?.vat_id || company?.registration_id);
}
