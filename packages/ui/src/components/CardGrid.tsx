import { Children, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme';
import { useResponsive } from '../provider';

export interface CardGridProps {
  /** Minimum width a cell may shrink to before wrapping to the next row. */
  minColumnWidth?: number;
  /** Gap between cells. Default `md`. */
  gap?: keyof typeof spacing;
  /** Force a single column regardless of width. */
  single?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Responsive card grid: each child becomes a flexing cell that grows to fill
 * the row and wraps once it would drop below `minColumnWidth`. On narrow
 * viewports (or `single`) cells stack full-width. Replaces the hand-rolled
 * `grid / cell / cellWide / cellFull` scaffold duplicated across the list tabs.
 */
export function CardGrid({
  minColumnWidth = 260,
  gap = 'md',
  single = false,
  children,
  style,
}: CardGridProps) {
  const { isWide } = useResponsive();
  const stack = single || !isWide;
  return (
    <View style={[styles.grid, { gap: spacing[gap] }, style]}>
      {Children.map(children, (child) =>
        child == null ? null : (
          <View style={stack ? styles.cellFull : [styles.cell, { minWidth: minColumnWidth }]}>
            {child}
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  cell: { flexGrow: 1, flexBasis: 0 },
  cellFull: { width: '100%' },
});
