/**
 * Shared domain constants for the Chrono SDK.
 *
 * Money is always integer cents. Time math flows through
 * `minutesToDays` / `computeEarnedCents` — keep the primitives here.
 */

export const MINUTES_PER_HOUR = 60;

/** Fallback working hours per day when a project does not specify one. */
export const DEFAULT_HOURS_PER_DAY = 7;

/** Default currency for a company when none is set. */
export const DEFAULT_CURRENCY = 'EUR';

/** Locale used by money/number formatting helpers. */
export const DEFAULT_LOCALE = 'fr-FR';
