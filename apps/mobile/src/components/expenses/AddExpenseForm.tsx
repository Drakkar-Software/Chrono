import { useState } from 'react';
import { Button, DatePicker, TextField, TitledCard, Txt } from '@chrono/ui';

import { FormActions } from '@/components/common/FormActions';
import { InlineError } from '@/components/common/ErrorState';
import { useT } from '@/lib/i18n';
import { toISODate } from '@/lib/date';
import { pickImage, type PickedImage } from '@/lib/image-upload';

export interface AddExpenseValues {
  description: string;
  amountCents: number;
  spentOn: string;
  category?: string;
  /** Picked but not-yet-uploaded receipt image — uploaded once the expense row exists. */
  receipt: PickedImage | null;
}

export interface AddExpenseFormProps {
  onAdd: (values: AddExpenseValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function toCents(input: string): number {
  const parsed = parseFloat(input.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/** Submit a project expense (with an optional receipt) for manager approval. */
export function AddExpenseForm({ onAdd, onCancel, isSubmitting = false }: AddExpenseFormProps) {
  const t = useT();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [spentOn, setSpentOn] = useState(new Date());
  const [category, setCategory] = useState('');
  const [receipt, setReceipt] = useState<PickedImage | null>(null);
  const [error, setError] = useState<string | undefined>();

  const pickReceipt = async () => {
    try {
      const picked = await pickImage();
      if (picked) setReceipt(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('comp.expense.receiptFailed'));
    }
  };

  const submit = () => {
    if (!description.trim()) {
      setError(t('comp.expense.errDescription'));
      return;
    }
    const cents = toCents(amount);
    if (cents <= 0) {
      setError(t('comp.expense.errAmount'));
      return;
    }
    setError(undefined);
    onAdd({
      description: description.trim(),
      amountCents: cents,
      spentOn: toISODate(spentOn),
      category: category.trim() || undefined,
      receipt,
    });
  };

  return (
    <TitledCard title={t('comp.expense.title')}>
      <TextField
        label={t('comp.expense.description')}
        value={description}
        onChangeText={setDescription}
        placeholder={t('comp.expense.descriptionPlaceholder')}
      />
      <TextField
        label={t('comp.expense.amount')}
        value={amount}
        onChangeText={setAmount}
        placeholder="50"
        keyboardType="decimal-pad"
      />
      <DatePicker label={t('comp.expense.spentOn')} value={spentOn} onChange={setSpentOn} maximumDate={new Date()} />
      <TextField
        label={t('comp.expense.category')}
        value={category}
        onChangeText={setCategory}
        placeholder={t('comp.expense.categoryPlaceholder')}
      />
      <Button
        title={receipt ? t('comp.expense.receiptAttached') : t('comp.expense.attachReceipt')}
        variant="secondary"
        size="sm"
        onPress={() => void pickReceipt()}
      />
      {receipt ? (
        <Txt variant="caption" tone="textMuted">
          {t('comp.expense.receiptReady')}
        </Txt>
      ) : null}
      <InlineError message={error ?? ''} />
      <FormActions
        submitLabel={t('comp.expense.submitBtn')}
        onSubmit={submit}
        busy={isSubmitting}
        onCancel={onCancel}
      />
    </TitledCard>
  );
}
