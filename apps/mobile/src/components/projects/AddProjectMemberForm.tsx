import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Picker, TextField, Txt, spacing } from '@chrono/ui';
import type { PickerOption } from '@chrono/ui';

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
  const [userId, setUserId] = useState(candidates[0]?.value ?? '');
  const [tjm, setTjm] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    if (!userId) return;
    const tjmCents = toCents(tjm);
    if (tjmCents !== null && tjmCents < 0) {
      setError('Day rate cannot be negative');
      return;
    }
    setError(undefined);
    onAdd(userId, tjmCents);
  };

  return (
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading">Add member</Txt>
      <Picker
        label="Member"
        value={userId}
        onValueChange={setUserId}
        options={candidates}
        placeholder="Select a member"
      />
      <TextField
        label="Day rate (optional)"
        value={tjm}
        onChangeText={setTjm}
        placeholder="Defaults to project TJM"
        keyboardType="decimal-pad"
      />
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
      <Button
        title="Add"
        onPress={submit}
        loading={isSubmitting}
        disabled={candidates.length === 0}
        fullWidth
      />
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});
