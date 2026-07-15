import { useMemo } from 'react';
import {
  DEFAULT_WORKING_WEEKDAYS,
  businessDaysInMonth,
  businessDaysRemaining,
  holidayDatesForYear,
  resolveWorkingWeekdays,
} from '@chrono/sdk';
import { useActiveCompany } from '@/lib/active-company-context';
import { todayISO } from '@/lib/date';
import { useCompanyMembers } from './use-company-members';
import { useCompanyHolidays } from './use-company-holidays';

/**
 * Resolves the max business days a person may log in a given month, from the
 * company's default working weekdays, an optional per-member override, and
 * the company's holiday calendar (recurring holidays expanded into the
 * month's year). Also exposes business days remaining from today.
 */
export function useMaxBusinessDays(userId: string | undefined, monthISO: string) {
  const { companyId, company } = useActiveCompany();
  const { data: members, isLoading: membersLoading } = useCompanyMembers(companyId ?? undefined);
  const { data: holidays, isLoading: holidaysLoading } = useCompanyHolidays(companyId ?? undefined);

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

  return {
    workingWeekdays,
    holidayDates,
    maxBusinessDays,
    remainingBusinessDays,
    isLoading: membersLoading || holidaysLoading,
  };
}
