import { useState } from 'react';
import { Picker, TextField, TitledCard } from '@chrono/ui';
import { revenueSourceLabel } from '@chrono/sdk';
import type { Json, RevenueSourceType } from '@chrono/sdk';
import { FormActions } from '@/components/common/FormActions';
import { InlineError } from '@/components/common/ErrorState';
import { useT } from '@/lib/i18n';

export interface AddRevenueSourceValues {
  name: string;
  type: RevenueSourceType;
  content: Json;
}

export interface AddRevenueSourceFormProps {
  onAdd: (values: AddRevenueSourceValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const TYPE_OPTIONS = (['time_based', 'recurring', 'self_billing'] as RevenueSourceType[]).map((t) => ({
  label: revenueSourceLabel(t),
  value: t,
}));

function toCents(input: string): number {
  const parsed = parseFloat(input.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function toNumber(input: string): number | undefined {
  const parsed = parseFloat(input.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Add a revenue source; the amount field's meaning follows the chosen type. */
export function AddRevenueSourceForm({ onAdd, onCancel, isSubmitting = false }: AddRevenueSourceFormProps) {
  const t = useT();
  const [name, setName] = useState('');
  const [type, setType] = useState<RevenueSourceType>('time_based');
  const [amount, setAmount] = useState('');
  const [markup, setMarkup] = useState('');
  // time_based manual invoice override: fill either field, the other is
  // inferred from the client day rate (`amount`) above.
  const [days, setDays] = useState('');
  const [total, setTotal] = useState('');
  const [error, setError] = useState<string | undefined>();

  const amountLabel = type === 'recurring' ? t('comp.revsource.monthlyAmount') : t('comp.revsource.clientDayRate');
  const tjmCents = toCents(amount);

  const onDaysChange = (value: string) => {
    setDays(value);
    const n = toNumber(value);
    if (n !== undefined && tjmCents > 0) {
      setTotal((Math.round(n * tjmCents) / 100).toFixed(2));
    } else if (value.trim() === '') {
      setTotal('');
    }
  };

  const onTotalChange = (value: string) => {
    setTotal(value);
    if (value.trim() === '') {
      setDays('');
      return;
    }
    if (tjmCents > 0) {
      setDays((toCents(value) / tjmCents).toFixed(2));
    }
  };

  const submit = () => {
    if (!name.trim()) {
      setError(t('comp.revsource.errName'));
      return;
    }
    const cents = toCents(amount);
    if (cents < 0) {
      setError(t('comp.revsource.errNegative', { label: amountLabel }));
      return;
    }
    let content: Json;
    if (type === 'recurring') {
      content = { monthly_amount_cents: cents };
    } else if (type === 'self_billing') {
      const markupPct = Number.isFinite(parseFloat(markup.replace(',', '.')))
        ? parseFloat(markup.replace(',', '.'))
        : 0;
      if (markupPct < -100) {
        setError(t('comp.revsource.errMarkupMin'));
        return;
      }
      content = {
        client_tjm_cents: cents,
        markup_pct: markupPct,
      };
    } else {
      const manualDays = toNumber(days);
      const manualTotalCents = total.trim() ? toCents(total) : manualDays !== undefined ? Math.round(manualDays * cents) : undefined;
      if (manualTotalCents !== undefined && manualTotalCents < 0) {
        setError(t('comp.revsource.errNegative', { label: t('comp.revsource.totalInvoiced') }));
        return;
      }
      content =
        manualTotalCents !== undefined
          ? {
              client_tjm_cents: cents,
              manual_amount_cents: manualTotalCents,
              manual_days: manualDays ?? (cents > 0 ? manualTotalCents / cents : 0),
            }
          : { client_tjm_cents: cents };
    }
    setError(undefined);
    onAdd({ name: name.trim(), type, content });
  };

  return (
    <TitledCard title={t('comp.revsource.title')}>
      <TextField label={t('comp.field.name')} value={name} onChangeText={setName} placeholder={t('comp.revsource.namePlaceholder')} />
      <Picker
        label={t('comp.revsource.type')}
        value={type}
        onValueChange={(v) => setType(v as RevenueSourceType)}
        options={TYPE_OPTIONS}
      />
      <TextField
        label={amountLabel}
        value={amount}
        onChangeText={setAmount}
        placeholder="500"
        keyboardType="decimal-pad"
      />
      {type === 'self_billing' ? (
        <TextField
          label={t('comp.revsource.markup')}
          value={markup}
          onChangeText={setMarkup}
          placeholder="0"
          keyboardType="decimal-pad"
        />
      ) : null}
      {type === 'time_based' ? (
        <>
          <TextField
            label={t('comp.revsource.daysInvoiced')}
            value={days}
            onChangeText={onDaysChange}
            placeholder="10"
            keyboardType="decimal-pad"
          />
          <TextField
            label={t('comp.revsource.totalInvoiced')}
            value={total}
            onChangeText={onTotalChange}
            placeholder="5000"
            keyboardType="decimal-pad"
          />
        </>
      ) : null}
      <InlineError message={error ?? ''} />
      <FormActions
        submitLabel={t('comp.revsource.addSource')}
        onSubmit={submit}
        busy={isSubmitting}
        onCancel={onCancel}
      />
    </TitledCard>
  );
}
