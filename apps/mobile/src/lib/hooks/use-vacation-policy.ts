import { useMemo } from 'react';
import { DEFAULT_HOURS_PER_DAY, vacationDaysUsedInYear, yearBounds } from '@chrono/sdk';
import { useActiveCompany } from '@/lib/active-company-context';
import { todayISO } from '@/lib/date';
import { useUserTimeOff } from './use-time-off';

/**
 * The company's paid-vacation policy (`max_vacation_days_per_year`, null =
 * unlimited) resolved against how many `kind: 'vacation'` days the user has
 * already taken this calendar year. `workingWeekdays`/`holidayDates` are the
 * already-resolved figures from `useMaxBusinessDays`, reused here instead of
 * re-deriving them.
 */
export function useVacationPolicy(userId: string | undefined, workingWeekdays: number[], holidayDates: string[]) {
  const { companyId, company } = useActiveCompany();
  const today = todayISO();
  const year = useMemo(() => Number(today.slice(0, 4)), [today]);
  const yearRange = useMemo(() => yearBounds(today), [today]);
  const { data: yearTimeOff, isLoading } = useUserTimeOff(userId, companyId ?? undefined, yearRange.start, yearRange.end);

  const maxVacationDaysPerYear = company?.max_vacation_days_per_year ?? null;

  const vacationDaysUsed = useMemo(
    () => vacationDaysUsedInYear(yearTimeOff ?? [], year, workingWeekdays, holidayDates, DEFAULT_HOURS_PER_DAY),
    [yearTimeOff, year, workingWeekdays, holidayDates],
  );

  const vacationDaysRemaining =
    maxVacationDaysPerYear == null ? null : Math.max(0, maxVacationDaysPerYear - vacationDaysUsed);

  return { maxVacationDaysPerYear, vacationDaysUsed, vacationDaysRemaining, isLoading };
}
