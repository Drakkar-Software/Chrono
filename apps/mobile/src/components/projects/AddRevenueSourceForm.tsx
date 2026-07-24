import { useState } from 'react';
import { Picker, Segmented, TextField, TitledCard } from '@chrono/ui';
import { REM_KINDS, revenueSourceLabel, type Json, type RemKind, type RevenueSourceType } from '@chrono/sdk';
import { FormActions } from '@/components/common/FormActions';
import { InlineError } from '@/components/common/ErrorState';
import { useT } from '@/lib/i18n';
import { resolveDayRateCents, toCents, toNumber } from './AddRevenueSourceForm.lib';
import { remKindRequired } from '@/lib/rem-form.lib';

export interface AddRevenueSourceValues {
  name: string;
  type: RevenueSourceType;
  content: Json;
  /** Free-text reference to the invoice number/id in the manager's own invoicing system. */
  externalInvoiceId?: string;
  /** Mark the recognized amount for this source paid immediately (default: due by client). */
  markPaid: boolean;
  remKind: RemKind | null;
}

const TYPE_OPTIONS = (['time_based', 'recurring', 'self_billing'] as RevenueSourceType[]).map((t) => ({
  label: revenueSourceLabel(t),
  value: t,
}));

export interface AddRevenueSourceFormProps {
  onAdd: (values: AddRevenueSourceValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  /** The project's default TJM — used as the day rate when the field below is left blank. */
  defaultTjmCents?: number | null;
  /** When set, rem_kind may be required for product policies. */
  remPolicy?: import('@chrono/sdk').RemPolicy;
}

/** Add a revenue source; the amount field's meaning follows the chosen type. */
export function AddRevenueSourceForm({
  onAdd,
  onCancel,
  isSubmitting = false,
  defaultTjmCents,
  remPolicy = 'staffing',
}: AddRevenueSourceFormProps) {
  const t = useT();
  const [name, setName] = useState('');
  const [type, setType] = useState<RevenueSourceType>('time_based');
  const [amount, setAmount] = useState('');
  const [markup, setMarkup] = useState('');
  // time_based manual invoice override: fill either field, the other is
  // inferred from the client day rate (`amount`, falling back to the
  // project's default TJM when left blank) above.
  const [days, setDays] = useState('');
  const [total, setTotal] = useState('');
  const [externalInvoiceId, setExternalInvoiceId] = useState('');
  const [paidStatus, setPaidStatus] = useState<'due' | 'paid'>('due');
  const [remKind, setRemKind] = useState<string>('');
  const [error, setError] = useState<string | undefined>();

  const paidOptions = [
    { label: t('details.dueByClient'), value: 'due' },
    { label: t('details.paid'), value: 'paid' },
  ];

  const remKindOptions = [
    { label: t('rem.kind.none'), value: '' },
    ...REM_KINDS.map((k) => ({ label: t(`rem.kind.${k}`), value: k })),
  ];

  const amountLabel = type === 'recurring' ? t('comp.revsource.monthlyAmount') : t('comp.revsource.clientDayRate');
  // Recurring's "amount" is a literal monthly figure, no day-rate fallback.
  const tjmCents = type === 'recurring' ? toCents(amount) : resolveDayRateCents(amount, defaultTjmCents);
  const amountPlaceholder =
    type !== 'recurring' && defaultTjmCents ? String(Math.round(defaultTjmCents / 100)) : '500';

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
    // Resolved rate (falls back to the project default when left blank) for
    // time_based/self_billing; recurring's amount is used literally.
    const cents = tjmCents;
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
      const overrideRequested = days.trim() !== '' || total.trim() !== '';
      if (overrideRequested && cents <= 0 && !total.trim()) {
        // Days were entered but there's no day rate to derive a total from —
        // without this guard the override silently saved as a 0€ total.
        setError(t('comp.revsource.errTjmRequired'));
        return;
      }
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
    if (remKindRequired(remPolicy) && !remKind) {
      setError(t('rem.kind.required'));
      return;
    }
    setError(undefined);
    onAdd({
      name: name.trim(),
      type,
      content,
      externalInvoiceId: externalInvoiceId.trim() || undefined,
      markPaid: paidStatus === 'paid',
      remKind: remKind ? (remKind as RemKind) : null,
    });
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
      <Picker
        label={t('rem.kind.label')}
        value={remKind}
        onValueChange={setRemKind}
        options={remKindOptions}
      />
      <TextField
        label={amountLabel}
        value={amount}
        onChangeText={setAmount}
        placeholder={amountPlaceholder}
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
      <TextField
        label={t('comp.revsource.externalInvoiceId')}
        value={externalInvoiceId}
        onChangeText={setExternalInvoiceId}
        placeholder={t('comp.revsource.externalInvoiceIdPlaceholder')}
      />
      <Segmented options={paidOptions} value={paidStatus} onValueChange={(v) => setPaidStatus(v as 'due' | 'paid')} />
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
