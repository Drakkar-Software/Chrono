import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, DatePicker, IconButton, Segmented, TextField, Txt, spacing } from '@chrono/ui';
import { DEFAULT_WORKING_WEEKDAYS, countHolidaysInYear, exceedsHolidayPolicy } from '@chrono/sdk';
import type { CompanyMembership } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { toISODate } from '@/lib/date';
import { useCompanyMutations } from '@/lib/hooks/use-companies';
import { useCompanyHolidayMutations, useCompanyHolidays } from '@/lib/hooks/use-company-holidays';
import { InlineError } from '@/components/common/ErrorState';
import { WeekdayToggle } from './WeekdayToggle';

export interface WorkingDaysCardProps {
  company: CompanyMembership;
}

/**
 * Company-level working-days config: default working weekdays, the holiday
 * policy (max holidays/year), and the holiday calendar itself (one-off or
 * recurring). Feeds the business-day cap enforced when logging time.
 */
export function WorkingDaysCard({ company }: WorkingDaysCardProps) {
  const t = useT();
  const { update, error: companyError } = useCompanyMutations();
  const { data: holidays, isLoading } = useCompanyHolidays(company.id);
  const { add, remove, error: holidayError, isPending: addingHoliday } = useCompanyHolidayMutations();

  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date());
  const [recurring, setRecurring] = useState<'oneoff' | 'recurring'>('oneoff');
  const [addError, setAddError] = useState<string | undefined>();

  const workingWeekdays = company.working_weekdays ?? DEFAULT_WORKING_WEEKDAYS;
  const [maxHolidays, setMaxHolidays] = useState(
    company.max_holidays_per_year != null ? String(company.max_holidays_per_year) : '',
  );

  const onWorkingWeekdaysChange = (value: number[]) => {
    void update(company.id, { working_weekdays: value });
  };

  const saveMaxHolidays = () => {
    const trimmed = maxHolidays.trim();
    const parsed = trimmed === '' ? null : parseInt(trimmed, 10);
    if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) return;
    void update(company.id, { max_holidays_per_year: parsed });
  };

  const addHoliday = async () => {
    if (!name.trim()) {
      setAddError(t('tabs.settings.holidayNameRequired'));
      return;
    }
    // Check the policy against the count for the YEAR OF THE SELECTED DATE
    // (not always "this calendar year") — a manager can add a holiday for a
    // future year, and that year has its own count.
    const targetYear = Number(toISODate(date).slice(0, 4));
    const yearCount = countHolidaysInYear(holidays ?? [], targetYear);
    if (exceedsHolidayPolicy(yearCount, 1, company.max_holidays_per_year ?? null)) {
      setAddError(t('tabs.settings.holidayPolicyExceeded', { max: company.max_holidays_per_year ?? 0 }));
      return;
    }
    setAddError(undefined);
    await add({
      company_id: company.id,
      holiday_date: toISODate(date),
      name: name.trim(),
      recurring: recurring === 'recurring',
    });
    setName('');
  };

  return (
    <>
      <View style={styles.field}>
        <Txt variant="label" tone="textMuted">
          {t('tabs.settings.workingDays')}
        </Txt>
        <WeekdayToggle value={workingWeekdays} onChange={onWorkingWeekdaysChange} />
        <Txt variant="caption" tone="textMuted">
          {t('tabs.settings.workingDaysHint')}
        </Txt>
      </View>

      <View style={styles.field}>
        <TextField
          label={t('tabs.settings.maxHolidaysPerYear')}
          value={maxHolidays}
          onChangeText={setMaxHolidays}
          placeholder={t('tabs.settings.unlimited')}
          keyboardType="number-pad"
        />
        <Txt variant="caption" tone="textMuted">
          {t('tabs.settings.maxHolidaysPerYearHint')}
        </Txt>
        <Button title={t('common.save')} size="sm" variant="secondary" onPress={saveMaxHolidays} />
        {companyError ? <InlineError error={companyError} /> : null}
      </View>

      <View style={styles.field}>
        <Txt variant="label" tone="textMuted">
          {t('tabs.settings.addHoliday')}
        </Txt>
        <TextField
          label={t('tabs.settings.holidayName')}
          value={name}
          onChangeText={setName}
          placeholder={t('tabs.settings.holidayNamePlaceholder')}
        />
        <DatePicker label={t('common.date')} value={date} onChange={setDate} />
        <Segmented
          options={[
            { label: t('tabs.settings.oneOff'), value: 'oneoff' },
            { label: t('tabs.settings.recurringYearly'), value: 'recurring' },
          ]}
          value={recurring}
          onValueChange={(v) => setRecurring(v as 'oneoff' | 'recurring')}
        />
        {addError ? <InlineError message={addError} /> : null}
        {holidayError ? <InlineError error={holidayError} /> : null}
        <Button title={t('tabs.settings.addHoliday')} onPress={() => void addHoliday()} loading={addingHoliday} size="sm" />
      </View>

      <View style={styles.field}>
        {isLoading && !holidays ? null : (holidays ?? []).length === 0 ? (
          <Txt variant="caption" tone="textMuted">
            {t('tabs.settings.noHolidays')}
          </Txt>
        ) : (
          (holidays ?? []).map((h) => (
            <View key={h.id} style={styles.holidayRow}>
              <Txt variant="body" numberOfLines={1} style={styles.holidayName}>
                {h.name || h.holiday_date}
              </Txt>
              <Txt variant="caption" tone="textMuted">
                {h.recurring ? t('tabs.settings.recurringYearly') : h.holiday_date}
              </Txt>
              <IconButton name="close" size={18} onPress={() => void remove(h.id)} accessibilityLabel={t('common.remove')} />
            </View>
          ))
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  holidayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 36 },
  holidayName: { flex: 1 },
});
