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
import { FieldRow } from '@/components/common/FieldRow';

export interface LogEntryValues {
  projectId: string;
  entryDate: Date;
  durationMinutes: number;
  description: string;
  billable: boolean;
}

export interface LogEntryFormProps {
  projectOptions: PickerOption[];
  onSubmit: (values: LogEntryValues) => void;
  isSubmitting?: boolean;
  defaultBillable?: boolean;
}

const BILLABLE_OPTIONS = [
  { label: 'Billable', value: 'billable' },
  { label: 'Non-billable', value: 'nonbillable' },
];

/** Manual time-entry composer. Owns its field state; emits a normalized value. */
export function LogEntryForm({
  projectOptions,
  onSubmit,
  isSubmitting = false,
  defaultBillable = true,
}: LogEntryFormProps) {
  const [projectId, setProjectId] = useState(projectOptions[0]?.value ?? '');
  const [entryDate, setEntryDate] = useState(new Date());
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(defaultBillable ? 'billable' : 'nonbillable');
  const [error, setError] = useState<string | undefined>();

  const durationMinutes = useMemo(() => {
    const parsed = parseFloat(hours.replace(',', '.'));
    return Number.isFinite(parsed) ? Math.round(parsed * 60) : 0;
  }, [hours]);

  const submit = () => {
    if (!projectId) {
      setError('Pick a project');
      return;
    }
    if (durationMinutes <= 0) {
      setError('Enter a duration in hours');
      return;
    }
    setError(undefined);
    onSubmit({
      projectId,
      entryDate,
      durationMinutes,
      description: description.trim(),
      billable: billable === 'billable',
    });
    setHours('');
    setDescription('');
  };

  return (
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading">Log time</Txt>
      <Picker
        label="Project"
        value={projectId}
        onValueChange={setProjectId}
        options={projectOptions}
        placeholder="Select a project"
      />
      <FieldRow>
        <DatePicker label="Date" value={entryDate} onChange={setEntryDate} maximumDate={new Date()} />
        <TextField
          label="Hours"
          value={hours}
          onChangeText={setHours}
          placeholder="e.g. 7.5"
          keyboardType="decimal-pad"
          error={error}
        />
      </FieldRow>
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="What did you work on?"
        multiline
      />
      <View style={styles.segment}>
        <Segmented options={BILLABLE_OPTIONS} value={billable} onValueChange={setBillable} />
      </View>
      <Button
        title="Add entry"
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
