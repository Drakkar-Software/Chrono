import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, DatePicker, Segmented, TextField, TitledCard, spacing } from '@chrono/ui';
import type { TablesUpdate, TimeEntry } from '@chrono/sdk';
import { FieldRow } from '@/components/common/FieldRow';
import { FormActions } from '@/components/common/FormActions';
import { fromISODate, toISODate } from '@/lib/date';
import { useT } from '@/lib/i18n';

export interface EditEntryFormProps {
  entry: Pick<TimeEntry, 'entry_date' | 'duration_minutes' | 'description' | 'billable'>;
  onSave: (patch: TablesUpdate<'time_entries'>) => void;
  onDelete: () => void;
  isSaving?: boolean;
}

/** Edit an existing pending time entry (project is fixed). */
export function EditEntryForm({ entry, onSave, onDelete, isSaving = false }: EditEntryFormProps) {
  const t = useT();
  const billableOptions = [
    { label: t('comp.time.billable'), value: 'billable' },
    { label: t('comp.time.nonBillable'), value: 'nonbillable' },
  ];
  const [date, setDate] = useState(fromISODate(entry.entry_date));
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
      entry_date: toISODate(date),
      duration_minutes: durationMinutes,
      description: description.trim() || null,
      billable: billable === 'billable',
    });
  };

  return (
    <TitledCard title={t('comp.time.editEntry')}>
      <FieldRow>
        <DatePicker label={t('common.date')} value={date} onChange={setDate} maximumDate={new Date()} />
        <TextField label={t('comp.time.hours')} value={hours} onChangeText={setHours} keyboardType="decimal-pad" />
      </FieldRow>
      <TextField label={t('comp.time.description')} value={description} onChangeText={setDescription} multiline />
      <View style={styles.segment}>
        <Segmented options={billableOptions} value={billable} onValueChange={setBillable} />
      </View>
      <FormActions submitLabel={t('common.save')} onSubmit={save} busy={isSaving} />
      <Button title={t('comp.time.deleteEntry')} variant="danger" onPress={onDelete} />
    </TitledCard>
  );
}

const styles = StyleSheet.create({
  segment: { marginTop: spacing.xs },
});
