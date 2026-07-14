import { useState } from 'react';
import { Picker, TextField, TitledCard, Txt } from '@chrono/ui';
import type { PickerOption } from '@chrono/ui';
import { FormActions } from '@/components/common/FormActions';
import { useT } from '@/lib/i18n';

export interface AddReferrerFormProps {
  candidates: PickerOption[];
  /** Percentage still assignable before hitting the 100% cap. */
  remainingPct: number;
  onAdd: (userId: string, percent: number) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

/** Add a referrer with a percentage cut, capped at the remaining amount. */
export function AddReferrerForm({ candidates, remainingPct, onAdd, onCancel, isSubmitting = false }: AddReferrerFormProps) {
  const t = useT();
  const [userId, setUserId] = useState(candidates[0]?.value ?? '');
  const [percent, setPercent] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    const pct = parseFloat(percent.replace(',', '.'));
    if (!userId) {
      setError(t('comp.field.selectMember'));
      return;
    }
    if (!Number.isFinite(pct) || pct <= 0) {
      setError(t('comp.referrer.errPercent'));
      return;
    }
    if (pct > remainingPct) {
      setError(t('comp.referrer.onlyRemaining', { n: remainingPct }));
      return;
    }
    setError(undefined);
    onAdd(userId, pct);
  };

  return (
    <TitledCard title={t('comp.referrer.title')}>
      <Txt variant="caption" tone="textMuted">
        {t('comp.referrer.stillAssignable', { n: remainingPct })}
      </Txt>
      <Picker
        label={t('comp.field.member')}
        value={userId}
        onValueChange={setUserId}
        options={candidates}
        placeholder={t('comp.field.selectMember')}
      />
      <TextField
        label={t('comp.referrer.percent')}
        value={percent}
        onChangeText={setPercent}
        placeholder="10"
        keyboardType="decimal-pad"
        error={error}
      />
      <FormActions
        submitLabel={t('comp.referrer.title')}
        onSubmit={submit}
        busy={isSubmitting}
        submitDisabled={candidates.length === 0 || remainingPct <= 0}
        onCancel={onCancel}
      />
    </TitledCard>
  );
}
