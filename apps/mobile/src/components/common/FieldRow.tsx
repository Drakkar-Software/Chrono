import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing, useResponsive } from '@chrono/ui';

export interface FieldRowProps {
  /** Two (or more) form controls to lay out side-by-side on wide screens. */
  children: ReactNode;
}

/**
 * Lays related form fields in a row on wide screens and stacks them on narrow.
 * Each child gets equal flex; on phones they fall back to a comfortable column.
 */
export function FieldRow({ children }: FieldRowProps) {
  const { isWide } = useResponsive();
  return (
    <View style={[styles.wrap, isWide && styles.row]}>
      {Children.map(children, (child) => (
        <View style={styles.cell}>{child}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  cell: { flex: 1 },
});
