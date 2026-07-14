import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, TextField, Txt, spacing } from '@chrono/ui';

export interface RejectDialogProps {
  /** Called with the typed reason (non-empty). */
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isBusy?: boolean;
}

/** Inline reason input for rejecting a time entry — requires a non-empty reason. */
export function RejectDialog({ onConfirm, onCancel, isBusy = false }: RejectDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();

  const confirm = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Enter a reason for rejecting');
      return;
    }
    setError(undefined);
    onConfirm(trimmed);
  };

  return (
    <View style={styles.wrap}>
      <TextField
        label="Rejection reason"
        value={reason}
        onChangeText={setReason}
        placeholder="Why is this entry rejected?"
        multiline
      />
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
      <View style={styles.actions}>
        <Button title="Cancel" variant="ghost" size="sm" onPress={onCancel} disabled={isBusy} />
        <Button title="Confirm reject" variant="danger" size="sm" onPress={confirm} loading={isBusy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
