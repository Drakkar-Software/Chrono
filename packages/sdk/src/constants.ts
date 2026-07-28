/**
 * Shared domain constants for the Chrono SDK.
 *
 * Money is always integer cents. Time math flows through
 * `minutesToDays` / `computeEarnedCents` — keep the primitives here.
 */

export const MINUTES_PER_HOUR = 60;

/** Default company fee applied to eligible revenue, as a percentage. */
export const DEFAULT_COMPANY_FEE_PCT = 5;

/** Default maximum remuneration share per partner, as a percentage. */
export const DEFAULT_REM_MAX_PERCENT = 75;

/** Default product-service license share of post-fee revenue. */
export const DEFAULT_LICENSE_PCT = 30;

/** Fixed monthly capacity baseline used by remuneration calculations. */
export const DEFAULT_MONTHLY_CAPACITY_DAYS = 22;

/** Fallback working hours per day when a project does not specify one. */
export const DEFAULT_HOURS_PER_DAY = 8;

/** Default annual paid-vacation allowance, in working days. */
export const DEFAULT_PAID_VACATION_DAYS = 15;

/** Default company working weekdays (ISO: 1=Mon..7=Sun) — Mon-Fri. */
export const DEFAULT_WORKING_WEEKDAYS = [1, 2, 3, 4, 5];

/** Default currency for a company when none is set. */
export const DEFAULT_CURRENCY = 'EUR';

/** Locale used by money/number formatting helpers. */
export const DEFAULT_LOCALE = 'fr-FR';
