import { useState } from 'react';
import { DatePicker, Picker, TextField, TitledCard } from '@chrono/ui';
import { monthKey } from '@chrono/sdk';
import type { FixedCostCadence } from '@chrono/sdk';
import { FormActions } from '@/components/common/FormActions';
import { InlineError } from '@/components/common/ErrorState';
import { useT } from '@/lib/i18n';
import { toISODate } from '@/lib/date';

export interface AddFixedCostValues {
  name: string;
  cadence: FixedCostCadence;
  amountCents: number;
  /** 'YYYY-MM-01', set when cadence is 'one_off'. */
  periodMonth?: string;
  /** 'YYYY-MM-DD', set when cadence is 'recurring'. */
  startsOn?: string;
}

export interface AddFixedCostFormProps {
  onAdd: (values: AddFixedCostValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const CADENCE_OPTIONS: { label: string; value: FixedCostCadence }[] = [
  { label: 'cadenceRecurring', value: 'recurring' },
  { label: 'cadenceOneOff', value: 'one_off' },
];

function toCents(input: string): number {
  const parsed = parseFloat(input.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/** Add a project period fixed cost (hosting, tooling, etc.). */
export function AddFixedCostForm({ onAdd, onCancel, isSubmitting = false }: AddFixedCostFormProps) {
  const t = useT();
  const [name, setName] = useState('');
  const [cadence, setCadence] = useState<FixedCostCadence>('recurring');
  const [amount, setAmount] = useState('');
  const [startsOn, setStartsOn] = useState(new Date());
  const [periodMonth, setPeriodMonth] = useState(new Date());
  const [error, setError] = useState<string | undefined>();

  const cadenceOptions = CADENCE_OPTIONS.map((o) => ({ label: t(`comp.fixedcost.${o.label}`), value: o.value }));

  const submit = () => {
    if (!name.trim()) {
      setError(t('comp.fixedcost.errName'));
      return;
    }
    const cents = toCents(amount);
    if (cents < 0) {
      setError(t('comp.fixedcost.errNegative'));
      return;
    }
    setError(undefined);
    onAdd({
      name: name.trim(),
      cadence,
      amountCents: cents,
      periodMonth: cadence === 'one_off' ? monthKey(toISODate(periodMonth)) : undefined,
      startsOn: cadence === 'recurring' ? toISODate(startsOn) : undefined,
    });
  };

  return (
    <TitledCard title={t('comp.fixedcost.title')}>
      <TextField label={t('comp.field.name')} value={name} onChangeText={setName} placeholder={t('comp.fixedcost.namePlaceholder')} />
      <Picker
        label={t('comp.fixedcost.cadence')}
        value={cadence}
        onValueChange={(v) => setCadence(v as FixedCostCadence)}
        options={cadenceOptions}
      />
      <TextField
        label={t('comp.fixedcost.amount')}
        value={amount}
        onChangeText={setAmount}
        placeholder="20"
        keyboardType="decimal-pad"
      />
      {cadence === 'recurring' ? (
        <DatePicker label={t('comp.fixedcost.startsOn')} value={startsOn} onChange={setStartsOn} />
      ) : (
        <DatePicker label={t('comp.fixedcost.periodMonth')} value={periodMonth} onChange={setPeriodMonth} />
      )}
      <InlineError message={error ?? ''} />
      <FormActions
        submitLabel={t('comp.fixedcost.addCost')}
        onSubmit={submit}
        busy={isSubmitting}
        onCancel={onCancel}
      />
    </TitledCard>
  );
}
