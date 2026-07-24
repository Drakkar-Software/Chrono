import { useState } from 'react';
import { Picker, Segmented, TextField, TitledCard, Txt } from '@chrono/ui';
import { REM_POLICIES, type Project, type ProjectStatus, type RemPolicy } from '@chrono/sdk';
import { FieldRow } from '@/components/common/FieldRow';
import { FormActions } from '@/components/common/FormActions';
import { InlineError } from '@/components/common/ErrorState';
import { RemPolicyHelp } from '@/components/projects/RemPolicyHelp';
import { useT } from '@/lib/i18n';
import { validateProjectRemFields } from '@/lib/rem-form.lib';

export interface EditProjectValues {
  name: string;
  clientName: string;
  description: string;
  defaultTjmCents: number | null;
  budgetCents: number | null;
  hoursPerDay: number;
  status: ProjectStatus;
  vatRate: number | null;
  remPolicy: RemPolicy;
  jungleFictitiousTjmCents: number | null;
}

export interface EditProjectFormProps {
  project: Project;
  onSave: (values: EditProjectValues) => void;
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
export function EditProjectForm({ project, onSave, isSubmitting = false }: EditProjectFormProps) {
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
  const [remPolicy, setRemPolicy] = useState<RemPolicy>(project.rem_policy ?? 'staffing');
  const [jungleTjm, setJungleTjm] = useState(fromCents(project.jungle_fictitious_tjm_cents));
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
    const jungleCents = remPolicy === 'jungle' ? toCents(jungleTjm) : null;
    const remErr = validateProjectRemFields({
      remPolicy,
      remKind:
        remPolicy === 'product_pool'
          ? 'direct_sales'
          : remPolicy === 'product_service'
            ? 'product_service'
            : null,
      jungleFictitiousTjmCents: jungleCents,
    });
    if (remErr === 'jungle_tjm') {
      setError(t('rem.project.jungleTjmRequired'));
      return;
    }
    onSave({
      name: name.trim(),
      clientName: clientName.trim(),
      description: description.trim(),
      defaultTjmCents: tjmCents,
      budgetCents,
      hoursPerDay: hpd,
      status,
      vatRate: vat,
      remPolicy,
      jungleFictitiousTjmCents: jungleCents,
    });
  };

  return (
    <TitledCard title={t('comp.project.editTitle')}>
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
        submitLabel={t('comp.project.saveChanges')}
        onSubmit={submit}
        busy={isSubmitting}
      />
    </TitledCard>
  );
}
