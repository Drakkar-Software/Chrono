import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { DatePicker, Segmented, TextField, Txt, TitledCard, borders, radii, spacing, useTheme } from '@chrono/ui';
import type { PickerOption } from '@chrono/ui';
import { DEFAULT_HOURS_PER_DAY, minutesToDays, parseTags } from '@chrono/sdk';
import { FieldRow } from '@/components/common/FieldRow';
import { FormActions } from '@/components/common/FormActions';
import { InlineError } from '@/components/common/ErrorState';
import { useT } from '@/lib/i18n';
import { dayCapExceeded, isValidDurationMinutes, parseHoursToMinutes } from './time-entry-form.lib';

export interface LogEntryValues {
  projectId: string;
  entryDate: Date;
  durationMinutes: number;
  description: string;
  billable: boolean;
  tags: string[];
}

export interface LogEntryFormProps {
  projectOptions: PickerOption[];
  onSubmit: (values: LogEntryValues) => void;
  isSubmitting?: boolean;
  defaultBillable?: boolean;
  /** hours_per_day for each project in `projectOptions`, keyed by project id. */
  hoursPerDayByProject?: Record<string, number>;
  /** Days already logged this month (all projects), for the business-day cap guard. */
  monthDaysLogged?: number;
  /** Max business days for the month being logged into; the cap is skipped when 0/undefined. */
  maxBusinessDays?: number;
  /** Human label for the capped month, e.g. "July 2026" — used in the cap error message. */
  monthLabel?: string;
}

const QUICK_HOURS = ['0.5', '1', '2', '4', '8'];
const QUICK_CORRECTIONS = ['-0.5', '-1', '-2'];

/** Manual time-entry composer. Owns its field state; emits a normalized value. */
export function LogEntryForm({
  projectOptions,
  onSubmit,
  isSubmitting = false,
  defaultBillable = true,
  hoursPerDayByProject = {},
  monthDaysLogged = 0,
  maxBusinessDays = 0,
  monthLabel = '',
}: LogEntryFormProps) {
  const t = useT();
  const billableOptions = [
    { label: t('comp.time.billable'), value: 'billable' },
    { label: t('comp.time.nonBillable'), value: 'nonbillable' },
  ];
  const [projectId, setProjectId] = useState(projectOptions[0]?.value ?? '');
  const [entryDate, setEntryDate] = useState(new Date());
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [billable, setBillable] = useState(defaultBillable ? 'billable' : 'nonbillable');
  const [error, setError] = useState<string | undefined>();

  const durationMinutes = useMemo(() => parseHoursToMinutes(hours), [hours]);
  const isCorrection = durationMinutes < 0;

  const submit = () => {
    if (!projectId) {
      setError(t('comp.time.errPickProject'));
      return;
    }
    if (!isValidDurationMinutes(durationMinutes)) {
      setError(t('comp.time.errEnterDuration'));
      return;
    }
    const hoursPerDay = hoursPerDayByProject[projectId] ?? DEFAULT_HOURS_PER_DAY;
    if (
      maxBusinessDays > 0 &&
      dayCapExceeded(durationMinutes, hoursPerDay, monthDaysLogged, maxBusinessDays)
    ) {
      const loggedAfter = monthDaysLogged + minutesToDays(durationMinutes, hoursPerDay);
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
    onSubmit({
      projectId,
      entryDate,
      durationMinutes,
      description: description.trim(),
      // Corrections claw back billable work — never create non-billable headroom.
      billable: isCorrection ? true : billable === 'billable',
      tags: parseTags(tags),
    });
    setHours('');
    setDescription('');
    setTags('');
  };

  return (
    <TitledCard title={t('comp.time.logTime')}>
      <View style={styles.field}>
        <Txt variant="label" tone="textMuted">
          {t('comp.field.project')}
        </Txt>
        {projectOptions.length === 0 ? (
          <Txt variant="body" tone="textMuted">
            {t('comp.time.noProjectsHint')}
          </Txt>
        ) : (
          <ChipRow options={projectOptions} value={projectId} onChange={setProjectId} />
        )}
      </View>

      <View style={styles.field}>
        <Txt variant="label" tone="textMuted">
          {t('comp.time.quickDuration')}
        </Txt>
        <ChipRow
          options={QUICK_HOURS.map((h) => ({ label: `${h}h`, value: h }))}
          value={hours}
          onChange={setHours}
        />
      </View>

      <View style={styles.field}>
        <Txt variant="label" tone="textMuted">
          {t('comp.time.quickCorrection')}
        </Txt>
        <ChipRow
          options={QUICK_CORRECTIONS.map((h) => ({ label: `${h}h`, value: h }))}
          value={hours}
          onChange={setHours}
        />
      </View>

      <FieldRow>
        <TextField
          label={t('comp.time.hours')}
          value={hours}
          onChangeText={setHours}
          placeholder={t('comp.time.hoursPlaceholder')}
          keyboardType="numbers-and-punctuation"
        />
        <DatePicker label={t('common.date')} value={entryDate} onChange={setEntryDate} maximumDate={new Date()} />
      </FieldRow>
      {isCorrection ? (
        <Txt variant="caption" tone="warning">
          {t('comp.time.correctionHint')}
        </Txt>
      ) : null}
      <TextField
        label={t('comp.time.description')}
        value={description}
        onChangeText={setDescription}
        placeholder={t('comp.time.descriptionPlaceholder')}
        multiline
      />
      <TextField
        label={t('comp.time.tagsOptional')}
        value={tags}
        onChangeText={setTags}
        placeholder={t('comp.time.tagsPlaceholder')}
        autoCapitalize="none"
      />
      {isCorrection ? null : (
        <View style={styles.segment}>
          <Segmented options={billableOptions} value={billable} onValueChange={setBillable} />
        </View>
      )}
      <InlineError message={error} />
      <FormActions
        submitLabel={t('comp.time.addEntry')}
        onSubmit={submit}
        busy={isSubmitting}
        submitDisabled={projectOptions.length === 0}
      />
    </TitledCard>
  );
}

/**
 * A horizontal row of single-tap selection chips — replaces a modal picker
 * for short option lists (a freelancer's handful of active projects, quick
 * duration presets) so the common case never has to open an overlay.
 */
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
  segment: { marginTop: spacing.xs },
  chipRow: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: borders.thin,
  },
});
