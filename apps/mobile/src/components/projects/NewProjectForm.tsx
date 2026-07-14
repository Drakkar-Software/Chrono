import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, TextField, Txt, spacing } from '@chrono/ui';
import { DEFAULT_HOURS_PER_DAY } from '@chrono/sdk';
import { FieldRow } from '@/components/common/FieldRow';

export interface NewProjectValues {
  name: string;
  clientName: string;
  description: string;
  defaultTjmCents: number | null;
  budgetCents: number | null;
  hoursPerDay: number;
}

export interface NewProjectFormProps {
  onCreate: (values: NewProjectValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function toCents(input: string): number | null {
  const parsed = parseFloat(input.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

/** Minimal create-project form (name, client, day rate, hours/day). */
export function NewProjectForm({ onCreate, onCancel, isSubmitting = false }: NewProjectFormProps) {
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [tjm, setTjm] = useState('');
  const [budget, setBudget] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState(String(DEFAULT_HOURS_PER_DAY));
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    if (!name.trim()) {
      setError('Enter a project name');
      return;
    }
    setError(undefined);
    const hpd = parseFloat(hoursPerDay.replace(',', '.'));
    onCreate({
      name: name.trim(),
      clientName: clientName.trim(),
      description: description.trim(),
      defaultTjmCents: toCents(tjm),
      budgetCents: toCents(budget),
      hoursPerDay: Number.isFinite(hpd) && hpd > 0 ? hpd : DEFAULT_HOURS_PER_DAY,
    });
  };

  return (
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading">New project</Txt>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Website redesign" error={error} />
      <TextField label="Client" value={clientName} onChangeText={setClientName} placeholder="Acme Inc." />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="What is this project about?"
        multiline
      />
      <FieldRow>
        <TextField
          label="Default day rate (TJM)"
          value={tjm}
          onChangeText={setTjm}
          placeholder="500"
          keyboardType="decimal-pad"
        />
        <TextField
          label="Budget"
          value={budget}
          onChangeText={setBudget}
          placeholder="60000"
          keyboardType="decimal-pad"
        />
      </FieldRow>
      <TextField
        label="Hours per day"
        value={hoursPerDay}
        onChangeText={setHoursPerDay}
        keyboardType="decimal-pad"
      />
      <Button title="Create project" onPress={submit} loading={isSubmitting} fullWidth />
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});
