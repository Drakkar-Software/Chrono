import { DEFAULT_HOURS_PER_DAY, minutesToDays, monthBounds } from '@chrono/sdk';

/** Date-range presets for scoping report figures. */
export type RangePreset = 'this_month' | 'last_month' | 'this_quarter' | 'all';

export const RANGE_OPTIONS: { label: string; value: RangePreset }[] = [
  { label: 'This month', value: 'this_month' },
  { label: 'Last month', value: 'last_month' },
  { label: 'This quarter', value: 'this_quarter' },
  { label: 'All', value: 'all' },
];

export interface DateRange {
  /** Inclusive lower bound 'YYYY-MM-DD', or undefined for open-ended. */
  from?: string;
  /** Inclusive upper bound 'YYYY-MM-DD', or undefined for open-ended. */
  to?: string;
}

function isoMonth(year: number, monthIdx0: number): string {
  return `${year}-${String(monthIdx0 + 1).padStart(2, '0')}-01`;
}

/** Resolve a preset to concrete { from, to } bounds relative to `todayISO`. */
export function rangeBounds(preset: RangePreset, todayISO: string): DateRange {
  if (preset === 'all') return {};
  const today = new Date(`${todayISO.slice(0, 10)}T00:00:00.000Z`);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();

  if (preset === 'this_month') {
    const b = monthBounds(isoMonth(y, m));
    return { from: b.start, to: b.end };
  }
  if (preset === 'last_month') {
    const prev = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
    const b = monthBounds(isoMonth(prev.y, prev.m));
    return { from: b.start, to: b.end };
  }
  // this_quarter — the three-month block containing the current month.
  const qStart = Math.floor(m / 3) * 3;
  const start = monthBounds(isoMonth(y, qStart)).start;
  const end = monthBounds(isoMonth(y, qStart + 2)).end;
  return { from: start, to: end };
}

/** True when a 'YYYY-MM-...' date string falls within an (inclusive) range. */
export function inRange(dateISO: string, range: DateRange): boolean {
  const day = dateISO.slice(0, 10);
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

export interface FreelancerSummary {
  userId: string;
  minutes: number;
  days: number;
  earnedCents: number;
  paidCents: number;
}

type BreakdownEntry = {
  user_id: string;
  duration_minutes: number;
  project: { hours_per_day: number } | null;
};

type BreakdownInvoice = {
  freelancer_id: string;
  earned_cents: number;
  amount_paid_cents: number;
};

/**
 * Aggregate approved billable time (days/hours) and invoiced earned/paid amounts
 * per freelancer. Days use each entry's project `hours_per_day`; earned/paid come
 * from the freelancer's invoices (already reconciled money, in cents).
 */
export function summarizeFreelancers(
  entries: BreakdownEntry[],
  invoices: BreakdownInvoice[],
): FreelancerSummary[] {
  const byUser = new Map<string, FreelancerSummary>();
  const get = (userId: string): FreelancerSummary => {
    let s = byUser.get(userId);
    if (!s) {
      s = { userId, minutes: 0, days: 0, earnedCents: 0, paidCents: 0 };
      byUser.set(userId, s);
    }
    return s;
  };

  for (const e of entries) {
    const s = get(e.user_id);
    s.minutes += e.duration_minutes ?? 0;
    s.days += minutesToDays(e.duration_minutes ?? 0, e.project?.hours_per_day ?? DEFAULT_HOURS_PER_DAY);
  }
  for (const inv of invoices) {
    const s = get(inv.freelancer_id);
    s.earnedCents += inv.earned_cents ?? 0;
    s.paidCents += inv.amount_paid_cents ?? 0;
  }

  return [...byUser.values()].sort(
    (a, b) => b.earnedCents - a.earnedCents || b.minutes - a.minutes,
  );
}
