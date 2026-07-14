import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Picker, TextField, Txt, spacing } from '@chrono/ui';
import type { PickerOption } from '@chrono/ui';
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
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading">{t('comp.member.addTitle')}</Txt>
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
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
      <Button
        title={t('common.add')}
        onPress={submit}
        loading={isSubmitting}
        disabled={candidates.length === 0}
        fullWidth
      />
      <Button title={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});
