import { useState } from 'react';
import { Picker, TextField, TitledCard } from '@chrono/ui';
import { DEFAULT_HOURS_PER_DAY, REM_POLICIES, type RemPolicy } from '@chrono/sdk';
import { FieldRow } from '@/components/common/FieldRow';
import { FormActions } from '@/components/common/FormActions';
import { InlineError } from '@/components/common/ErrorState';
import { RemPolicyHelp } from '@/components/projects/RemPolicyHelp';
import { useT } from '@/lib/i18n';
import { validateProjectRemFields } from '@/lib/rem-form.lib';

export interface NewProjectValues {
  name: string;
  clientName: string;
  description: string;
  defaultTjmCents: number | null;
  budgetCents: number | null;
  hoursPerDay: number;
  remPolicy: import('@chrono/sdk').RemPolicy;
  jungleFictitiousTjmCents: number | null;
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
  const [remPolicy, setRemPolicy] = useState<RemPolicy>('staffing');
  const [jungleTjm, setJungleTjm] = useState('');
  const [error, setError] = useState<string | undefined>();

  const policyOptions = REM_POLICIES.map((p) => ({
    label: t(`rem.policy.${p}`),
    value: p,
  }));

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
    const jungleCents = remPolicy === 'jungle' ? toCents(jungleTjm) : null;
    const remErr = validateProjectRemFields({
      remPolicy,
      remKind: remPolicy === 'product_pool' ? 'direct_sales' : remPolicy === 'product_service' ? 'product_service' : null,
      jungleFictitiousTjmCents: jungleCents,
    });
    if (remErr === 'jungle_tjm') {
      setError(t('rem.project.jungleTjmRequired'));
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
      remPolicy,
      jungleFictitiousTjmCents: jungleCents,
    });
  };

  return (
    <TitledCard title={t('comp.project.newTitle')}>
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
      <Picker
        label={t('rem.project.policy')}
        value={remPolicy}
        onValueChange={(v) => setRemPolicy(v as RemPolicy)}
        options={policyOptions}
      />
      <RemPolicyHelp value={remPolicy} />
      {remPolicy === 'jungle' ? (
        <TextField
          label={t('rem.project.jungleTjm')}
          value={jungleTjm}
          onChangeText={setJungleTjm}
          placeholder="500"
          keyboardType="decimal-pad"
        />
      ) : null}
      <InlineError message={error ?? ''} />
      <FormActions
        submitLabel={t('comp.project.createBtn')}
        onSubmit={submit}
        busy={isSubmitting}
        onCancel={onCancel}
      />
    </TitledCard>
  );
}
