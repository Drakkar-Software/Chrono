import type { Catalog, Locale } from '../types';
import { commonCatalog } from './common';
import { landingCatalog } from './landing';
import { onboardingCatalog } from './onboarding';
import { tabsCatalog } from './tabs';
import { detailsCatalog } from './details';
import { componentsACatalog } from './componentsA';
import { componentsBCatalog } from './componentsB';

const slices = [
  commonCatalog,
  landingCatalog,
  onboardingCatalog,
  tabsCatalog,
  detailsCatalog,
  componentsACatalog,
  componentsBCatalog,
];

function merge(locale: Locale): Catalog {
  return Object.assign({}, ...slices.map((s) => s[locale]));
}

export const catalogs: Record<Locale, Catalog> = {
  en: merge('en'),
  fr: merge('fr'),
};
