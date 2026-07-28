/**
 * DB functions raise stable slugs, never user-facing copy (the app is
 * translated). A raised message is `slug` or `slug:arg[:arg…]` — for example
 * `capacity-exceeded:7` or `time-net-negative-correction:120:45`. The client
 * looks the slug up in its catalog and interpolates the args.
 */
export interface DbError {
  /** Stable slug, e.g. `rem-month-locked`. */
  slug: string;
  /** Values the DB appended to the slug, in order. */
  params: string[];
}

function extractMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return String(error);
}

// A slug is lowercase kebab-case; args are anything without a colon. Anchored so
// prose ("Only a manager can settle a project month") never parses as a slug.
const DB_ERROR_RE = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)+)((?::[^:]*)*)$/;

/**
 * Parse a thrown Postgres error into its slug and params, or null when the
 * message is not a slug (a prose message from a function not yet converted, a
 * PostgREST/network failure, …) so callers can fall back to generic handling.
 */
export function parseDbError(error: unknown): DbError | null {
  const msg = extractMessage(error).trim();
  const match = DB_ERROR_RE.exec(msg);
  if (!match) return null;
  const params = match[2] ? match[2].slice(1).split(':') : [];
  return { slug: match[1], params };
}
