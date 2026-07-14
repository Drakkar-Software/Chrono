import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Segmented, TextField, Txt, spacing } from '@chrono/ui';
import type { Project, ProjectStatus } from '@chrono/sdk';
import { FieldRow } from '@/components/common/FieldRow';

export interface EditProjectValues {
  name: string;
  clientName: string;
  description: string;
  defaultTjmCents: number | null;
  budgetCents: number | null;
  hoursPerDay: number;
  status: ProjectStatus;
  vatRate: number | null;
}

export interface EditProjectFormProps {
  project: Project;
  onSave: (values: EditProjectValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function toCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = parseFloat(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function fromCents(cents: number | null): string {
  return cents == null ? '' : String(cents / 100);
}

const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Archived', value: 'archived' },
];

/** Edit an existing project, pre-filled from its current values. */
export function EditProjectForm({ project, onSave, onCancel, isSubmitting = false }: EditProjectFormProps) {
  const [name, setName] = useState(project.name);
  const [clientName, setClientName] = useState(project.client_name ?? '');
  const [description, setDescription] = useState(project.description ?? '');
  const [tjm, setTjm] = useState(fromCents(project.default_tjm_cents));
  const [budget, setBudget] = useState(fromCents(project.budget_cents));
  const [hoursPerDay, setHoursPerDay] = useState(String(project.hours_per_day));
  const [vatRate, setVatRate] = useState(project.vat_rate != null ? String(project.vat_rate) : '');
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    if (!name.trim()) {
      setError('Enter a project name');
      return;
    }
    const tjmCents = toCents(tjm);
    if (tjmCents !== null && tjmCents < 0) {
      setError('Day rate (TJM) cannot be negative');
      return;
    }
    const budgetCents = toCents(budget);
    if (budgetCents !== null && budgetCents < 0) {
      setError('Budget cannot be negative');
      return;
    }
    const hpd = parseFloat(hoursPerDay.replace(',', '.'));
    if (!Number.isFinite(hpd) || hpd <= 0) {
      setError('Hours per day must be greater than 0');
      return;
    }
    let vat: number | null = null;
    if (vatRate.trim()) {
      const parsed = parseFloat(vatRate.replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        setError('VAT rate must be between 0 and 100');
        return;
      }
      vat = parsed;
    }
    setError(undefined);
    onSave({
      name: name.trim(),
      clientName: clientName.trim(),
      description: description.trim(),
      defaultTjmCents: tjmCents,
      budgetCents,
      hoursPerDay: hpd,
      status,
      vatRate: vat,
    });
  };

  return (
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading">Edit project</Txt>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Website redesign" />
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
      <FieldRow>
        <TextField
          label="Hours per day"
          value={hoursPerDay}
          onChangeText={setHoursPerDay}
          keyboardType="decimal-pad"
        />
        <TextField
          label="VAT rate % (optional)"
          value={vatRate}
          onChangeText={setVatRate}
          placeholder="Inherit company"
          keyboardType="decimal-pad"
        />
      </FieldRow>
      <Txt variant="micro" mono uppercase tone="textMuted">
        Status
      </Txt>
      <Segmented options={STATUS_OPTIONS} value={status} onValueChange={(v) => setStatus(v as ProjectStatus)} />
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
      <Button title="Save changes" onPress={submit} loading={isSubmitting} fullWidth />
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});
