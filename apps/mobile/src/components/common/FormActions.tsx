import { StyleSheet, View } from 'react-native';
import { Button, spacing } from '@chrono/ui';

import { useT } from '@/lib/i18n';

export interface FormActionsProps {
  /** Primary submit label. */
  submitLabel: string;
  onSubmit: () => void;
  /** Show a spinner + block the submit button. */
  busy?: boolean;
  /** Disable the submit button (independent of `busy`). */
  submitDisabled?: boolean;
  /** Optional cancel handler — renders a secondary/ghost cancel button. */
  onCancel?: () => void;
  /** Cancel label. Defaults to the shared `common.cancel`. */
  cancelLabel?: string;
  /** `stack` (default): full-width submit over a ghost cancel. `row`: right-aligned pair. */
  layout?: 'stack' | 'row';
  /** Style the submit as destructive. */
  destructive?: boolean;
}

/**
 * The submit (+ optional cancel) footer that closes every form. `stack` gives a
 * full-width primary over a ghost cancel; `row` gives a right-aligned
 * cancel/submit pair (for compact inline dialogs).
 */
export function FormActions({
  submitLabel,
  onSubmit,
  busy = false,
  submitDisabled = false,
  onCancel,
  cancelLabel,
  layout = 'stack',
  destructive = false,
}: FormActionsProps) {
  const t = useT();
  const cancel = cancelLabel ?? t('common.cancel');
  const submitVariant = destructive ? 'danger' : 'primary';

  if (layout === 'row') {
    return (
      <View style={styles.row}>
        {onCancel ? <Button title={cancel} variant="ghost" onPress={onCancel} /> : null}
        <Button
          title={submitLabel}
          onPress={onSubmit}
          loading={busy}
          disabled={submitDisabled}
          variant={submitVariant}
        />
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <Button
        title={submitLabel}
        onPress={onSubmit}
        loading={busy}
        disabled={submitDisabled}
        variant={submitVariant}
        fullWidth
      />
      {onCancel ? <Button title={cancel} variant="ghost" onPress={onCancel} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
