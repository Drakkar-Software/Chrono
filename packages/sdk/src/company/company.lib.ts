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

/** The company's currency, defaulting when unset. */
export function companyCurrency(
  company: Pick<Company, 'currency'> | null | undefined,
): string {
  const currency = company?.currency?.trim();
  return currency && currency.length > 0 ? currency : DEFAULT_CURRENCY;
}
