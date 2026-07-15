import type { Project } from '../project/project.entity';
import { computeEarnedCents } from '../time-entry/time-entry.lib';
import type { TimeEntry } from '../time-entry/time-entry.entity';
import type { ProjectMember } from './project-member.entity';

/**
 * The day rate to bill a member at: their own rate, else the project default,
 * else zero.
 */
export function effectiveTjm(
  member: Pick<ProjectMember, 'tjm_cents'> | null | undefined,
  project: Pick<Project, 'default_tjm_cents'> | null | undefined,
): number {
  return member?.tjm_cents ?? project?.default_tjm_cents ?? 0;
}

/**
 * Value approved, billable, not-yet-invoiced time at each freelancer's
 * effective day rate. Mirrors the DB trigger that values an invoice's worked
 * minutes (`round(minutes / (hours_per_day*60) * coalesce(pm.tjm_cents,
 * p.default_tjm_cents, 0))`), so this is a faithful preview of what those
 * entries will earn once invoiced. Entries are grouped per user PER CALENDAR
 * MONTH — invoices are generated one per freelancer per month (see
 * `fetchMonthEntriesForInvoice`) — so summing minutes across months first
 * would round once where the server rounds once per month, drifting by a
 * cent or two whenever uninvoiced time spans more than one month.
 */
export function valueUninvoicedTime(
  entries: Array<
    Pick<TimeEntry, 'user_id' | 'duration_minutes' | 'status' | 'billable' | 'invoice_id' | 'deleted' | 'entry_date'>
  >,
  project: Pick<Project, 'default_tjm_cents' | 'hours_per_day'>,
  members: Array<Pick<ProjectMember, 'user_id' | 'tjm_cents'>>,
): number {
  const minutesByUserMonth = new Map<string, { userId: string; minutes: number }>();
  for (const e of entries) {
    if (e.status !== 'approved' || !e.billable || e.invoice_id != null || e.deleted) continue;
    const key = `${e.user_id}:${e.entry_date.slice(0, 7)}`;
    const group = minutesByUserMonth.get(key);
    if (group) group.minutes += e.duration_minutes ?? 0;
    else minutesByUserMonth.set(key, { userId: e.user_id, minutes: e.duration_minutes ?? 0 });
  }
  const memberByUser = new Map(members.map((m) => [m.user_id, m]));
  let total = 0;
  for (const { userId, minutes } of minutesByUserMonth.values()) {
    const tjm = effectiveTjm(memberByUser.get(userId), project);
    total += computeEarnedCents(minutes, project.hours_per_day, tjm);
  }
  return total;
}
