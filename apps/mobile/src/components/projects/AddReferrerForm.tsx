import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Picker, TextField, Txt, spacing } from '@chrono/ui';
import type { PickerOption } from '@chrono/ui';

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
  const [userId, setUserId] = useState(candidates[0]?.value ?? '');
  const [percent, setPercent] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    const pct = parseFloat(percent.replace(',', '.'));
    if (!userId) {
      setError('Select a member');
      return;
    }
    if (!Number.isFinite(pct) || pct <= 0) {
      setError('Enter a percentage');
      return;
    }
    if (pct > remainingPct) {
      setError(`Only ${remainingPct}% remaining`);
      return;
    }
    setError(undefined);
    onAdd(userId, pct);
  };

  return (
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading">Add referrer</Txt>
      <Txt variant="caption" tone="textMuted">
        {remainingPct}% still assignable
      </Txt>
      <Picker
        label="Member"
        value={userId}
        onValueChange={setUserId}
        options={candidates}
        placeholder="Select a member"
      />
      <TextField
        label="Percent"
        value={percent}
        onChangeText={setPercent}
        placeholder="10"
        keyboardType="decimal-pad"
        error={error}
      />
      <Button
        title="Add referrer"
        onPress={submit}
        loading={isSubmitting}
        disabled={candidates.length === 0 || remainingPct <= 0}
        fullWidth
      />
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});
