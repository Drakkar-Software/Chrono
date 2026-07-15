/** Public site origin, used to build absolute canonical / OG URLs for SEO. */
export const SITE_URL = (
  process.env.EXPO_PUBLIC_SITE_URL || 'https://chrono.drakkar.software'
).replace(/\/$/, '');

/** Absolute URL for a site-relative path (e.g. `/blog/foo` → full origin). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
