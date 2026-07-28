import { parseDbError } from '@chrono/sdk';
import type { TFn } from '@/lib/i18n';

/**
 * Translate an error raised by a DB function. Those raise stable slugs, never
 * copy (see the error-slug migration), so the sentence lives in the `db.*`
 * catalog and any values the DB appended arrive as `{0}`, `{1}`, …
 *
 * Returns null when the error is not a known slug — a PostgREST/network
 * failure, or a slug this app version has no copy for — so callers fall back to
 * their own generic message rather than showing a raw slug.
 */
export function dbErrorMessage(error: unknown, t: TFn): string | null {
  const parsed = parseDbError(error);
  if (!parsed) return null;
  const key = `db.${parsed.slug}`;
  const params = Object.fromEntries(parsed.params.map((value, i) => [String(i), value]));
  const message = t(key, params);
  return message === key ? null : message;
}
