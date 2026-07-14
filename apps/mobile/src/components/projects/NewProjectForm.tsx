import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, TextField, Txt, spacing } from '@chrono/ui';
import { DEFAULT_HOURS_PER_DAY } from '@chrono/sdk';
import { FieldRow } from '@/components/common/FieldRow';
import { useT } from '@/lib/i18n';

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
  const t = useT();
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [tjm, setTjm] = useState('');
  const [budget, setBudget] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState(String(DEFAULT_HOURS_PER_DAY));
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
    setError(undefined);
    onCreate({
      name: name.trim(),
      clientName: clientName.trim(),
      description: description.trim(),
      defaultTjmCents: tjmCents,
      budgetCents,
      hoursPerDay: hpd,
    });
  };

  return (
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading">{t('comp.project.newTitle')}</Txt>
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
      <TextField
        label={t('comp.project.hoursPerDay')}
        value={hoursPerDay}
        onChangeText={setHoursPerDay}
        keyboardType="decimal-pad"
      />
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
      <Button title={t('comp.project.createBtn')} onPress={submit} loading={isSubmitting} fullWidth />
      <Button title={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});
