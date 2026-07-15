import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { DatePicker, Segmented, TextField, Txt, TitledCard, borders, radii, spacing, useTheme } from '@chrono/ui';
import type { PickerOption } from '@chrono/ui';
import { DEFAULT_HOURS_PER_DAY, minutesToDays } from '@chrono/sdk';
import type { TimeOffKind } from '@chrono/sdk';
import { FieldRow } from '@/components/common/FieldRow';
import { FormActions } from '@/components/common/FormActions';
import { InlineError } from '@/components/common/ErrorState';
import { useT } from '@/lib/i18n';
import { parseHoursToMinutes } from './time-entry-form.lib';

export interface TimeOffValues {
  offDate: Date;
  /** null = a full day off. */
  durationMinutes: number | null;
  kind: TimeOffKind;
  note: string;
}

export interface TimeOffFormProps {
  onSubmit: (values: TimeOffValues) => void;
  isSubmitting?: boolean;
  /** Remaining paid-vacation days this year — null = unlimited (no cap). Enforced only when `kind` is 'vacation'. */
  vacationDaysRemaining?: number | null;
}

const KINDS: TimeOffKind[] = ['vacation', 'sick', 'personal', 'holiday'];

/** Self-service time-off composer: a date, full day or a partial number of hours, a kind, and an optional note. */
export function TimeOffForm({ onSubmit, isSubmitting = false, vacationDaysRemaining = null }: TimeOffFormProps) {
  const t = useT();
  const kindOptions: PickerOption[] = useMemo(
    () => KINDS.map((k) => ({ label: t(`comp.timeOff.kind.${k}`), value: k })),
    [t],
  );

  const [offDate, setOffDate] = useState(new Date());
  const [amount, setAmount] = useState<'full' | 'partial'>('full');
  const [hours, setHours] = useState('');
  const [kind, setKind] = useState<TimeOffKind>('vacation');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    let durationMinutes: number | null = null;
    if (amount === 'partial') {
      durationMinutes = parseHoursToMinutes(hours);
      if (durationMinutes <= 0) {
        setError(t('comp.timeOff.errEnterHours'));
        return;
      }
    }
    if (kind === 'vacation' && vacationDaysRemaining != null) {
      const requestedDays = durationMinutes == null ? 1 : minutesToDays(durationMinutes, DEFAULT_HOURS_PER_DAY);
      if (requestedDays > vacationDaysRemaining) {
        setError(t('comp.timeOff.errVacationCapExceeded', { n: vacationDaysRemaining }));
        return;
      }
    }
    setError(undefined);
    onSubmit({ offDate, durationMinutes, kind, note: note.trim() });
    setHours('');
    setNote('');
  };

  return (
    <TitledCard title={t('comp.timeOff.takeTimeOff')}>
      <FieldRow>
        <DatePicker label={t('common.date')} value={offDate} onChange={setOffDate} />
        <View style={styles.field}>
          <Txt variant="label" tone="textMuted">
            {t('comp.timeOff.amount')}
          </Txt>
          <Segmented
            options={[
              { label: t('comp.timeOff.fullDay'), value: 'full' },
              { label: t('comp.timeOff.partial'), value: 'partial' },
            ]}
            value={amount}
            onValueChange={(v) => setAmount(v as 'full' | 'partial')}
          />
        </View>
      </FieldRow>

      {amount === 'partial' ? (
        <TextField
          label={t('comp.timeOff.hoursOff')}
          value={hours}
          onChangeText={setHours}
          placeholder={t('comp.time.hoursPlaceholder')}
          keyboardType="decimal-pad"
        />
      ) : null}

      <View style={styles.field}>
        <Txt variant="label" tone="textMuted">
          {t('comp.timeOff.type')}
        </Txt>
        <ChipRow options={kindOptions} value={kind} onChange={(v) => setKind(v as TimeOffKind)} />
        {kind === 'vacation' && vacationDaysRemaining != null ? (
          <Txt variant="caption" tone="textMuted">
            {t('comp.timeOff.vacationRemaining', { n: vacationDaysRemaining })}
          </Txt>
        ) : null}
      </View>

      <TextField
        label={t('comp.timeOff.noteOptional')}
        value={note}
        onChangeText={setNote}
        placeholder={t('comp.timeOff.notePlaceholder')}
        multiline
      />

      <InlineError message={error} />
      <FormActions submitLabel={t('comp.timeOff.addTimeOff')} onSubmit={submit} busy={isSubmitting} />
    </TitledCard>
  );
}

/** Same single-tap chip row as `LogEntryForm`'s project/duration pickers. */
function ChipRow({
  options,
  value,
  onChange,
}: {
  options: PickerOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? colors.accentBg : pressed ? colors.hover : colors.surface,
                borderColor: active ? colors.accentBorder : colors.border,
              },
            ]}
          >
            <Txt variant="bodyMedium" tone={active ? 'accent' : 'text'} numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  chipRow: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: borders.thin,
  },
});
