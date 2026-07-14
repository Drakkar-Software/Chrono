import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  DatePicker,
  Picker,
  Segmented,
  TextField,
  Txt,
  spacing,
} from '@chrono/ui';
import type { PickerOption } from '@chrono/ui';
import { parseTags } from '@chrono/sdk';
import { FieldRow } from '@/components/common/FieldRow';
import { useT } from '@/lib/i18n';

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
}

/** Manual time-entry composer. Owns its field state; emits a normalized value. */
export function LogEntryForm({
  projectOptions,
  onSubmit,
  isSubmitting = false,
  defaultBillable = true,
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

  const durationMinutes = useMemo(() => {
    const parsed = parseFloat(hours.replace(',', '.'));
    return Number.isFinite(parsed) ? Math.round(parsed * 60) : 0;
  }, [hours]);

  const submit = () => {
    if (!projectId) {
      setError(t('comp.time.errPickProject'));
      return;
    }
    if (durationMinutes <= 0) {
      setError(t('comp.time.errEnterDuration'));
      return;
    }
    setError(undefined);
    onSubmit({
      projectId,
      entryDate,
      durationMinutes,
      description: description.trim(),
      billable: billable === 'billable',
      tags: parseTags(tags),
    });
    setHours('');
    setDescription('');
    setTags('');
  };

  return (
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading">{t('comp.time.logTime')}</Txt>
      <Picker
        label={t('comp.field.project')}
        value={projectId}
        onValueChange={setProjectId}
        options={projectOptions}
        placeholder={t('comp.field.selectProject')}
      />
      <FieldRow>
        <DatePicker label={t('common.date')} value={entryDate} onChange={setEntryDate} maximumDate={new Date()} />
        <TextField
          label={t('comp.time.hours')}
          value={hours}
          onChangeText={setHours}
          placeholder={t('comp.time.hoursPlaceholder')}
          keyboardType="decimal-pad"
        />
      </FieldRow>
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
      <View style={styles.segment}>
        <Segmented options={billableOptions} value={billable} onValueChange={setBillable} />
      </View>
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
      <Button
        title={t('comp.time.addEntry')}
        onPress={submit}
        loading={isSubmitting}
        disabled={projectOptions.length === 0}
        fullWidth
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  segment: { marginTop: spacing.xs },
});
