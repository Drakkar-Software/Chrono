import { useMemo } from 'react';
import {
  DEFAULT_HOURS_PER_DAY,
  DEFAULT_WORKING_WEEKDAYS,
  businessDaysInMonth,
  businessDaysRemaining,
  holidayDatesForYear,
  monthBounds,
  resolveWorkingWeekdays,
  timeOffDaysInMonth,
} from '@chrono/sdk';
import { useActiveCompany } from '@/lib/active-company-context';
import { todayISO } from '@/lib/date';
import { useCompanyMembers } from './use-company-members';
import { useCompanyHolidays } from './use-company-holidays';
import { useUserTimeOff } from './use-time-off';

/**
 * Resolves the max business days a person may log in a given month, from the
 * company's default working weekdays, an optional per-member override, and
 * the company's holiday calendar (recurring holidays expanded into the
 * month's year). Also exposes business days remaining from today, and both
 * figures netted of the person's own time off (`netBusinessDays`,
 * `netRemainingBusinessDays`) — a full day off subtracts 1, a partial day
 * subtracts its fraction.
 */
export function useMaxBusinessDays(userId: string | undefined, monthISO: string) {
  const { companyId, company } = useActiveCompany();
  const { data: members, isLoading: membersLoading } = useCompanyMembers(companyId ?? undefined);
  const { data: holidays, isLoading: holidaysLoading } = useCompanyHolidays(companyId ?? undefined);
  const month = useMemo(() => monthBounds(monthISO), [monthISO]);
  const { data: timeOff, isLoading: timeOffLoading } = useUserTimeOff(
    userId,
    companyId ?? undefined,
    month.start,
    month.end,
  );

  const workingWeekdays = useMemo(() => {
    const companyDefault = company?.working_weekdays ?? DEFAULT_WORKING_WEEKDAYS;
    const me = (members ?? []).find((m) => m.user_id === userId);
    return resolveWorkingWeekdays(companyDefault, me?.working_weekdays ?? null);
  }, [company?.working_weekdays, members, userId]);

  const year = Number(monthISO.slice(0, 4));
  const holidayDates = useMemo(
    () => holidayDatesForYear(holidays ?? [], year),
    [holidays, year],
  );

  const maxBusinessDays = useMemo(
    () => businessDaysInMonth(monthISO, workingWeekdays, holidayDates),
    [monthISO, workingWeekdays, holidayDates],
  );

  const remainingBusinessDays = useMemo(
    () => businessDaysRemaining(todayISO(), monthISO, workingWeekdays, holidayDates),
    [monthISO, workingWeekdays, holidayDates],
  );

  const timeOffDays = useMemo(
    () => timeOffDaysInMonth(timeOff ?? [], monthISO, workingWeekdays, holidayDates, DEFAULT_HOURS_PER_DAY),
    [timeOff, monthISO, workingWeekdays, holidayDates],
  );

  const upcomingTimeOffDays = useMemo(() => {
    const today = todayISO();
    const upcoming = (timeOff ?? []).filter((t) => t.off_date >= today);
    return timeOffDaysInMonth(upcoming, monthISO, workingWeekdays, holidayDates, DEFAULT_HOURS_PER_DAY);
  }, [timeOff, monthISO, workingWeekdays, holidayDates]);

  const netBusinessDays = Math.max(0, maxBusinessDays - timeOffDays);
  const netRemainingBusinessDays = Math.max(0, remainingBusinessDays - upcomingTimeOffDays);

  return {
    workingWeekdays,
    holidayDates,
    maxBusinessDays,
    remainingBusinessDays,
    timeOff: timeOff ?? [],
    timeOffDays,
    netBusinessDays,
    netRemainingBusinessDays,
    isLoading: membersLoading || holidaysLoading || timeOffLoading,
  };
}
