import { useState } from 'react';
import { Button, DatePicker, Picker, Segmented, TextField, TitledCard, Txt } from '@chrono/ui';
import { monthKey } from '@chrono/sdk';
import type { ProjectCostKind } from '@chrono/sdk';

import { FormActions } from '@/components/common/FormActions';
import { InlineError } from '@/components/common/ErrorState';
import { useT } from '@/lib/i18n';
import { toISODate } from '@/lib/date';
import { pickImage, type PickedImage } from '@/lib/image-upload';

export interface AddCostValues {
  kind: ProjectCostKind;
  label: string;
  amountCents: number;
  /** 'YYYY-MM-01', set when kind is 'one_off'. */
  periodMonth?: string;
  /** 'YYYY-MM-DD', set when kind is 'recurring'. */
  startsOn?: string;
  /** 'YYYY-MM-DD', optional bound for a recurring cost. */
  endsOn?: string;
  /** Recurring only: deduct from revenue every month automatically. */
  autoDeduct?: boolean;
  /** Pool kinds only: already paid, so it comes off the balance now. */
  paid?: boolean;
  /** 'YYYY-MM-DD', set when kind is 'reimbursable'. */
  spentOn?: string;
  category?: string;
  /** Picked but not-yet-uploaded receipt — uploaded once the row exists. */
  receipt?: PickedImage | null;
}

export interface AddCostFormProps {
  onAdd: (values: AddCostValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  /** Non-managers may only submit a reimbursable — the kind picker is hidden. */
  reimbursableOnly?: boolean;
}

function toCents(input: string): number {
  const parsed = parseFloat(input.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/** Add a project cost of any kind: recurring / one-off overhead, or a reimbursable. */
export function AddCostForm({
  onAdd,
  onCancel,
  isSubmitting = false,
  reimbursableOnly = false,
}: AddCostFormProps) {
  const t = useT();
  const [kind, setKind] = useState<ProjectCostKind>(reimbursableOnly ? 'reimbursable' : 'recurring');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [startsOn, setStartsOn] = useState(new Date());
  // DatePicker has no empty state, so "ongoing" is modelled as a separate
  // choice rather than a null date.
  const [bounded, setBounded] = useState(false);
  const [endsOn, setEndsOn] = useState(new Date());
  const [periodMonth, setPeriodMonth] = useState(new Date());
  const [spentOn, setSpentOn] = useState(new Date());
  const [category, setCategory] = useState('');
  const [receipt, setReceipt] = useState<PickedImage | null>(null);
  const [autoDeduct, setAutoDeduct] = useState(true);
  const [paidStatus, setPaidStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [error, setError] = useState<string | undefined>();

  const isReimbursable = kind === 'reimbursable';
  const isRecurring = kind === 'recurring';

  const kindOptions = [
    { label: t('comp.cost.kindRecurring'), value: 'recurring' },
    { label: t('comp.cost.kindOneOff'), value: 'one_off' },
    { label: t('comp.cost.kindReimbursable'), value: 'reimbursable' },
  ];

  const autoDeductOptions = [
    { label: t('comp.cost.autoDeductOn'), value: 'auto' },
    { label: t('comp.cost.autoDeductOff'), value: 'manual' },
  ];

  const paidOptions = [
    { label: t('comp.cost.unpaid'), value: 'unpaid' },
    { label: t('comp.cost.paid'), value: 'paid' },
  ];

  const endOptions = [
    { label: t('comp.cost.ongoing'), value: 'ongoing' },
    { label: t('comp.cost.untilDate'), value: 'until' },
  ];

  const pickReceipt = async () => {
    try {
      const picked = await pickImage();
      if (picked) setReceipt(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('comp.cost.receiptFailed'));
    }
  };

  const submit = () => {
    if (!label.trim()) {
      setError(t('comp.cost.errLabel'));
      return;
    }
    const cents = toCents(amount);
    // A reimbursable must be a real outlay; a pool cost may legitimately be 0.
    if (isReimbursable ? cents <= 0 : cents < 0) {
      setError(isReimbursable ? t('comp.cost.errAmount') : t('comp.cost.errNegative'));
      return;
    }
    if (isRecurring && bounded && toISODate(endsOn) < toISODate(startsOn)) {
      setError(t('comp.cost.errEndsBeforeStarts'));
      return;
    }
    setError(undefined);
    onAdd({
      kind,
      label: label.trim(),
      amountCents: cents,
      periodMonth: kind === 'one_off' ? monthKey(toISODate(periodMonth)) : undefined,
      startsOn: isRecurring ? toISODate(startsOn) : undefined,
      endsOn: isRecurring && bounded ? toISODate(endsOn) : undefined,
      autoDeduct: isRecurring ? autoDeduct : undefined,
      // An auto-deducting recurring cost is paid implicitly every month, so the
      // explicit paid flag would be redundant (and the DB ignores it there).
      paid: isReimbursable || (isRecurring && autoDeduct) ? undefined : paidStatus === 'paid',
      spentOn: isReimbursable ? toISODate(spentOn) : undefined,
      category: isReimbursable ? category.trim() || undefined : undefined,
      receipt: isReimbursable ? receipt : undefined,
    });
  };

  return (
    <TitledCard title={t('comp.cost.title')}>
      {reimbursableOnly ? null : (
        <Picker
          label={t('comp.cost.kind')}
          value={kind}
          onValueChange={(v) => setKind(v as ProjectCostKind)}
          options={kindOptions}
        />
      )}
      <TextField
        label={t('comp.cost.label')}
        value={label}
        onChangeText={setLabel}
        placeholder={t('comp.cost.labelPlaceholder')}
      />
      <TextField
        label={t('comp.cost.amount')}
        value={amount}
        onChangeText={setAmount}
        placeholder={isReimbursable ? '50' : '20'}
        keyboardType="decimal-pad"
      />

      {isRecurring ? (
        <>
          <DatePicker label={t('comp.cost.startsOn')} value={startsOn} onChange={setStartsOn} />
          <Segmented
            options={endOptions}
            value={bounded ? 'until' : 'ongoing'}
            onValueChange={(v) => setBounded(v === 'until')}
          />
          {bounded ? (
            <DatePicker
              label={t('comp.cost.endsOn')}
              value={endsOn}
              onChange={setEndsOn}
              minimumDate={startsOn}
            />
          ) : null}
          <Segmented
            options={autoDeductOptions}
            value={autoDeduct ? 'auto' : 'manual'}
            onValueChange={(v) => setAutoDeduct(v === 'auto')}
          />
          <Txt variant="caption" tone="textMuted">
            {autoDeduct ? t('comp.cost.autoDeductHint') : t('comp.cost.manualDeductHint')}
          </Txt>
        </>
      ) : null}

      {kind === 'one_off' ? (
        <DatePicker label={t('comp.cost.periodMonth')} value={periodMonth} onChange={setPeriodMonth} />
      ) : null}

      {isReimbursable ? (
        <>
          <DatePicker
            label={t('comp.cost.spentOn')}
            value={spentOn}
            onChange={setSpentOn}
            maximumDate={new Date()}
          />
          <TextField
            label={t('comp.cost.category')}
            value={category}
            onChangeText={setCategory}
            placeholder={t('comp.cost.categoryPlaceholder')}
          />
          <Button
            title={receipt ? t('comp.cost.receiptAttached') : t('comp.cost.attachReceipt')}
            variant="secondary"
            size="sm"
            onPress={() => void pickReceipt()}
          />
          {receipt ? (
            <Txt variant="caption" tone="textMuted">
              {t('comp.cost.receiptReady')}
            </Txt>
          ) : null}
        </>
      ) : null}

      {/* Paid only applies to a pool cost that isn't auto-deducting. */}
      {!isReimbursable && !(isRecurring && autoDeduct) ? (
        <Segmented
          options={paidOptions}
          value={paidStatus}
          onValueChange={(v) => setPaidStatus(v as 'unpaid' | 'paid')}
        />
      ) : null}

      <InlineError message={error ?? ''} />
      <FormActions
        submitLabel={isReimbursable ? t('comp.cost.submitBtn') : t('comp.cost.addCost')}
        onSubmit={submit}
        busy={isSubmitting}
        onCancel={onCancel}
      />
    </TitledCard>
  );
}
