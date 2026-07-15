/** Parse a locale-decimal string ("1234,56" or "1234.56") into integer cents. */
export function toCents(input: string): number {
  const parsed = parseFloat(input.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/** Parse a locale-decimal string into a plain number, or undefined if blank/invalid. */
export function toNumber(input: string): number | undefined {
  const parsed = parseFloat(input.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The day rate actually used to price a time-based/self-billing source: the
 * entered amount, or the project's default TJM when the field is left blank
 * (0 or unparseable).
 */
export function resolveDayRateCents(enteredAmount: string, defaultTjmCents: number | null | undefined): number {
  const entered = toCents(enteredAmount);
  return entered > 0 ? entered : (defaultTjmCents ?? 0);
}
