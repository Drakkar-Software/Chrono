/** Parse a locale-decimal hours string ("7,5" or "7.5") into whole minutes. */
export function parseHoursToMinutes(input: string): number {
  const parsed = parseFloat(input.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 60) : 0;
}

/** Format whole minutes back into a locale-decimal hours string (inverse of `parseHoursToMinutes`), trimming a trailing ".0". */
export function formatMinutesAsHoursInput(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : String(Math.round(hours * 100) / 100);
}
