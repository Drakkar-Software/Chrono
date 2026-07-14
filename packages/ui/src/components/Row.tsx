import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme';
import { Txt } from './Txt';

export interface RowProps {
  /** Left-aligned label. */
  label?: string;
  /** Right-aligned value text (ignored if `children` is provided). */
  value?: string;
  /** Custom right-aligned content — takes precedence over `value`. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * A label ↔ value row (space-between). Pass `value` for plain text or
 * `children` for a control/badge on the right.
 */
export function Row({ label, value, children, style }: RowProps) {
  return (
    <View style={[styles.row, style]}>
      {label != null ? (
        <Txt variant="body" tone="textMuted" style={styles.label}>
          {label}
        </Txt>
      ) : null}
      <View style={styles.value}>
        {children != null ? (
          children
        ) : value != null ? (
          <Txt variant="bodyMedium">{value}</Txt>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: spacing.md,
  },
  label: { flexShrink: 1 },
  value: { flexShrink: 0, alignItems: 'flex-end' },
});
