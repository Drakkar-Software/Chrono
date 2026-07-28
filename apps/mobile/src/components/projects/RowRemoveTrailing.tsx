import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, spacing } from '@chrono/ui';
import { useT } from '@/lib/i18n';

export interface RowRemoveTrailingProps {
  /** Existing trailing content (rate, amount, percent…) shown before the control. */
  children?: ReactNode;
  onRemove: () => void;
  removing?: boolean;
  /** Name of the row's subject, for the accessibility label. */
  label?: string;
  /**
   * Override the default "Remove" a11y verb (e.g. "Correct" for revenue sources
   * that keep history and insert offsetting entries).
   */
  actionLabel?: string;
}

/**
 * Trailing remove control for a project row (member / source / referrer). Uses a
 * two-tap inline confirm — first tap arms (swaps to confirm ✓ / cancel ✕), second
 * confirms — so a mis-tap can't silently delete without needing a global dialog.
 */
export function RowRemoveTrailing({
  children,
  onRemove,
  removing = false,
  label,
  actionLabel,
}: RowRemoveTrailingProps) {
  const t = useT();
  const [armed, setArmed] = useState(false);
  const verb = actionLabel ?? t('common.remove');
  const a11y = verb + (label ? ` — ${label}` : '');

  return (
    <View style={styles.wrap}>
      {children}
      {armed ? (
        <>
          <IconButton
            name="checkmark"
            tone="danger"
            disabled={removing}
            onPress={() => {
              setArmed(false);
              onRemove();
            }}
            accessibilityLabel={a11y}
          />
          <IconButton
            name="close"
            tone="textMuted"
            disabled={removing}
            onPress={() => setArmed(false)}
            accessibilityLabel={t('common.cancel')}
          />
        </>
      ) : (
        <IconButton
          name="trash-outline"
          tone="textMuted"
          disabled={removing}
          onPress={() => setArmed(true)}
          accessibilityLabel={a11y}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
