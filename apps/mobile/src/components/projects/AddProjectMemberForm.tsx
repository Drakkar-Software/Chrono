import { useState } from 'react';
import { Picker, TextField, TitledCard } from '@chrono/ui';
import type { PickerOption } from '@chrono/ui';
import { FormActions } from '@/components/common/FormActions';
import { InlineError } from '@/components/common/ErrorState';
import { useT } from '@/lib/i18n';

export interface AddProjectMemberFormProps {
  candidates: PickerOption[];
  onAdd: (userId: string, tjmCents: number | null) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function toCents(input: string): number | null {
  const parsed = parseFloat(input.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

/** Assign a company member to the project with an optional per-project TJM. */
export function AddProjectMemberForm({ candidates, onAdd, onCancel, isSubmitting = false }: AddProjectMemberFormProps) {
  const t = useT();
  const [userId, setUserId] = useState(candidates[0]?.value ?? '');
  const [tjm, setTjm] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    if (!userId) return;
    const tjmCents = toCents(tjm);
    if (tjmCents !== null && tjmCents < 0) {
      setError(t('comp.project.errDayRateNegative'));
      return;
    }
    setError(undefined);
    onAdd(userId, tjmCents);
  };

  return (
    <TitledCard title={t('comp.member.addTitle')}>
      <Picker
        label={t('comp.field.member')}
        value={userId}
        onValueChange={setUserId}
        options={candidates}
        placeholder={t('comp.field.selectMember')}
      />
      <TextField
        label={t('comp.member.dayRateOptional')}
        value={tjm}
        onChangeText={setTjm}
        placeholder={t('comp.member.dayRatePlaceholder')}
        keyboardType="decimal-pad"
      />
      <InlineError message={error ?? ''} />
      <FormActions
        submitLabel={t('common.add')}
        onSubmit={submit}
        busy={isSubmitting}
        submitDisabled={candidates.length === 0}
        onCancel={onCancel}
      />
    </TitledCard>
  );
}
