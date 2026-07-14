import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextField, spacing } from '@chrono/ui';

import { FormActions } from '@/components/common/FormActions';
import { InlineError } from '@/components/common/ErrorState';
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
      <InlineError message={error} />
      <FormActions
        submitLabel={t('compb.reject.confirm')}
        onSubmit={confirm}
        busy={isBusy}
        onCancel={onCancel}
        layout="row"
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
});
