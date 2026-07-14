import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Segmented, TextField, Txt, spacing } from '@chrono/ui';
import type { Project, ProjectStatus } from '@chrono/sdk';
import { FieldRow } from '@/components/common/FieldRow';
import { useT } from '@/lib/i18n';

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

/** Edit an existing project, pre-filled from its current values. */
export function EditProjectForm({ project, onSave, onCancel, isSubmitting = false }: EditProjectFormProps) {
  const t = useT();
  const statusOptions = [
    { label: t('status.active'), value: 'active' },
    { label: t('status.archived'), value: 'archived' },
  ];
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
      setError(t('comp.project.errName'));
      return;
    }
    const tjmCents = toCents(tjm);
    if (tjmCents !== null && tjmCents < 0) {
      setError(t('comp.project.errTjmNegative'));
      return;
    }
    const budgetCents = toCents(budget);
    if (budgetCents !== null && budgetCents < 0) {
      setError(t('comp.project.errBudgetNegative'));
      return;
    }
    const hpd = parseFloat(hoursPerDay.replace(',', '.'));
    if (!Number.isFinite(hpd) || hpd <= 0) {
      setError(t('comp.project.errHoursPerDay'));
      return;
    }
    let vat: number | null = null;
    if (vatRate.trim()) {
      const parsed = parseFloat(vatRate.replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        setError(t('comp.project.errVat'));
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
      <Txt variant="heading">{t('comp.project.editTitle')}</Txt>
      <TextField label={t('comp.field.name')} value={name} onChangeText={setName} placeholder={t('comp.project.namePlaceholder')} />
      <TextField label={t('comp.project.client')} value={clientName} onChangeText={setClientName} placeholder={t('comp.project.clientPlaceholder')} />
      <TextField
        label={t('comp.project.description')}
        value={description}
        onChangeText={setDescription}
        placeholder={t('comp.project.descriptionPlaceholder')}
        multiline
      />
      <FieldRow>
        <TextField
          label={t('comp.project.defaultTjm')}
          value={tjm}
          onChangeText={setTjm}
          placeholder="500"
          keyboardType="decimal-pad"
        />
        <TextField
          label={t('comp.project.budget')}
          value={budget}
          onChangeText={setBudget}
          placeholder="60000"
          keyboardType="decimal-pad"
        />
      </FieldRow>
      <FieldRow>
        <TextField
          label={t('comp.project.hoursPerDay')}
          value={hoursPerDay}
          onChangeText={setHoursPerDay}
          keyboardType="decimal-pad"
        />
        <TextField
          label={t('comp.project.vatRate')}
          value={vatRate}
          onChangeText={setVatRate}
          placeholder={t('comp.project.vatPlaceholder')}
          keyboardType="decimal-pad"
        />
      </FieldRow>
      <Txt variant="micro" mono uppercase tone="textMuted">
        {t('common.status')}
      </Txt>
      <Segmented options={statusOptions} value={status} onValueChange={(v) => setStatus(v as ProjectStatus)} />
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
      <Button title={t('comp.project.saveChanges')} onPress={submit} loading={isSubmitting} fullWidth />
      <Button title={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});
