export type Locale = 'en' | 'fr';

/** A flat catalog: dotted key -> template string (with {param} placeholders). */
export type Catalog = Record<string, string>;

/** A domain contributes an `en` and `fr` slice, merged into the full catalog. */
export interface CatalogSlice {
  en: Catalog;
  fr: Catalog;
}
