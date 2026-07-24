import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, DatePicker, Segmented, TextField, TitledCard, Txt, spacing } from '@chrono/ui';
import { DEFAULT_HOURS_PER_DAY, minutesToDays } from '@chrono/sdk';
import type { TablesUpdate, TimeEntry } from '@chrono/sdk';
import { FieldRow } from '@/components/common/FieldRow';
import { FormActions } from '@/components/common/FormActions';
import { InlineError } from '@/components/common/ErrorState';
import { fromISODate, toISODate } from '@/lib/date';
import { useT } from '@/lib/i18n';
import { dayCapExceeded, formatMinutesAsHoursInput, isValidDurationMinutes, parseHoursToMinutes } from './time-entry-form.lib';

export interface EditEntryFormProps {
  entry: Pick<TimeEntry, 'entry_date' | 'duration_minutes' | 'description' | 'billable'>;
  onSave: (patch: TablesUpdate<'time_entries'>) => void;
  onDelete: () => void;
  isSaving?: boolean;
  /** hours_per_day for this entry's (fixed) project. */
  hoursPerDay?: number;
  /** Days already logged this month on OTHER entries (this entry's own days excluded), for the business-day cap guard. */
  monthDaysLoggedExcludingThis?: number;
  /** Max business days for the entry's month; the cap is skipped when 0/undefined. */
  maxBusinessDays?: number;
  /** Human label for the capped month, e.g. "July 2026" — used in the cap error message. */
  monthLabel?: string;
}

/** Edit an existing pending time entry (project is fixed). */
export function EditEntryForm({
  entry,
  onSave,
  onDelete,
  isSaving = false,
  hoursPerDay = DEFAULT_HOURS_PER_DAY,
  monthDaysLoggedExcludingThis = 0,
  maxBusinessDays = 0,
  monthLabel = '',
}: EditEntryFormProps) {
  const t = useT();
  const billableOptions = [
    { label: t('comp.time.billable'), value: 'billable' },
    { label: t('comp.time.nonBillable'), value: 'nonbillable' },
  ];
  const [date, setDate] = useState(fromISODate(entry.entry_date));
  const [hours, setHours] = useState(formatMinutesAsHoursInput(entry.duration_minutes));
  const [description, setDescription] = useState(entry.description ?? '');
  const [billable, setBillable] = useState(entry.billable ? 'billable' : 'nonbillable');
  const [error, setError] = useState<string | undefined>();

  const durationMinutes = useMemo(() => parseHoursToMinutes(hours), [hours]);

  const save = () => {
    if (!isValidDurationMinutes(durationMinutes)) {
      setError(t('comp.time.errEnterDuration'));
      return;
    }
    if (
      maxBusinessDays > 0 &&
      dayCapExceeded(durationMinutes, hoursPerDay, monthDaysLoggedExcludingThis, maxBusinessDays)
    ) {
      const loggedAfter = monthDaysLoggedExcludingThis + minutesToDays(durationMinutes, hoursPerDay);
      setError(
        t('comp.time.errDayCapExceeded', {
          logged: loggedAfter.toFixed(1),
          max: maxBusinessDays,
          month: monthLabel,
        }),
      );
      return;
    }
    setError(undefined);
    onSave({
      entry_date: toISODate(date),
      duration_minutes: durationMinutes,
      description: description.trim() || null,
      billable: durationMinutes < 0 ? true : billable === 'billable',
    });
  };

  return (
    <TitledCard title={t('comp.time.editEntry')}>
      <FieldRow>
        <DatePicker label={t('common.date')} value={date} onChange={setDate} maximumDate={new Date()} />
        <TextField
          label={t('comp.time.hours')}
          value={hours}
          onChangeText={setHours}
          keyboardType="numbers-and-punctuation"
          placeholder={t('comp.time.hoursPlaceholder')}
        />
      </FieldRow>
      {durationMinutes < 0 ? (
        <Txt variant="caption" tone="warning">
          {t('comp.time.correctionHint')}
        </Txt>
      ) : null}
      <TextField label={t('comp.time.description')} value={description} onChangeText={setDescription} multiline />
      {durationMinutes < 0 ? null : (
        <View style={styles.segment}>
          <Segmented options={billableOptions} value={billable} onValueChange={setBillable} />
        </View>
      )}
      <InlineError message={error} />
      <FormActions submitLabel={t('common.save')} onSubmit={save} busy={isSaving} />
      <Button title={t('comp.time.deleteEntry')} variant="danger" onPress={onDelete} />
    </TitledCard>
  );
}

const styles = StyleSheet.create({
  segment: { marginTop: spacing.xs },
});
