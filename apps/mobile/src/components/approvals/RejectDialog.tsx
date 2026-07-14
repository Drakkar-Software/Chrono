import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, TextField, Txt, spacing } from '@chrono/ui';

import { useT } from '@/lib/i18n';

export interface RejectDialogProps {
  /** Called with the typed reason (non-empty). */
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isBusy?: boolean;
}

/** Inline reason input for rejecting a time entry — requires a non-empty reason. */
export function RejectDialog({ onConfirm, onCancel, isBusy = false }: RejectDialogProps) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();

  const confirm = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(t('compb.reject.reasonRequired'));
      return;
    }
    setError(undefined);
    onConfirm(trimmed);
  };

  return (
    <View style={styles.wrap}>
      <TextField
        label={t('compb.reject.reasonLabel')}
        value={reason}
        onChangeText={setReason}
        placeholder={t('compb.reject.reasonPlaceholder')}
        multiline
      />
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
      <View style={styles.actions}>
        <Button title={t('common.cancel')} variant="ghost" size="sm" onPress={onCancel} disabled={isBusy} />
        <Button title={t('compb.reject.confirm')} variant="danger" size="sm" onPress={confirm} loading={isBusy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
