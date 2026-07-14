import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, DatePicker, Segmented, TextField, Txt, spacing } from '@chrono/ui';
import type { TablesUpdate, TimeEntry } from '@chrono/sdk';
import { FieldRow } from '@/components/common/FieldRow';

export interface EditEntryFormProps {
  entry: Pick<TimeEntry, 'entry_date' | 'duration_minutes' | 'description' | 'billable'>;
  onSave: (patch: TablesUpdate<'time_entries'>) => void;
  onDelete: () => void;
  isSaving?: boolean;
}

const BILLABLE_OPTIONS = [
  { label: 'Billable', value: 'billable' },
  { label: 'Non-billable', value: 'nonbillable' },
];

/** Edit an existing pending time entry (project is fixed). */
export function EditEntryForm({ entry, onSave, onDelete, isSaving = false }: EditEntryFormProps) {
  const [date, setDate] = useState(new Date(`${entry.entry_date.slice(0, 10)}T00:00:00.000Z`));
  const [hours, setHours] = useState(String(entry.duration_minutes / 60));
  const [description, setDescription] = useState(entry.description ?? '');
  const [billable, setBillable] = useState(entry.billable ? 'billable' : 'nonbillable');

  const durationMinutes = useMemo(() => {
    const parsed = parseFloat(hours.replace(',', '.'));
    return Number.isFinite(parsed) ? Math.round(parsed * 60) : 0;
  }, [hours]);

  const save = () => {
    if (durationMinutes <= 0) return;
    onSave({
      entry_date: date.toISOString().slice(0, 10),
      duration_minutes: durationMinutes,
      description: description.trim() || null,
      billable: billable === 'billable',
    });
  };

  return (
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading">Edit entry</Txt>
      <DatePicker label="Date" value={date} onChange={setDate} maximumDate={new Date()} />
      <TextField label="Hours" value={hours} onChangeText={setHours} keyboardType="decimal-pad" />
      <TextField label="Description" value={description} onChangeText={setDescription} multiline />
      <View style={styles.segment}>
        <Segmented options={BILLABLE_OPTIONS} value={billable} onValueChange={setBillable} />
      </View>
      <Button title="Save" onPress={save} loading={isSaving} fullWidth />
      <Button title="Delete entry" variant="danger" onPress={onDelete} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  segment: { marginTop: spacing.xs },
});
