import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { Txt, borders, radii, spacing, useTheme } from '@chrono/ui';
import type { Palette } from '@chrono/ui';

export interface StatTileProps {
  /** Small caption above the value. */
  label: string;
  /** Plain-text value (rendered mono + tabular). Ignored when `children` set. */
  value?: string;
  /** Custom value node — e.g. a `<Money/>`. Takes precedence over `value`. */
  children?: ReactNode;
  /** Palette tone for a plain-text `value`. Default `text`. */
  tone?: keyof Palette;
  style?: StyleProp<ViewStyle>;
}

/**
 * A single labeled metric tile: caption over a bold value. Sits inside a
 * {@link StatRow} which wraps tiles horizontally on wide / narrow.
 */
export function StatTile({ label, value, children, tone = 'text', style }: StatTileProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        style,
      ]}
    >
      <Txt variant="micro" mono uppercase tone="textMuted" numberOfLines={1}>
        {label}
      </Txt>
      {children != null ? (
        children
      ) : (
        <Txt variant="heading" mono tabularNums tone={tone} numberOfLines={1}>
          {value ?? '—'}
        </Txt>
      )}
    </View>
  );
}

export interface StatRowProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Wrapping flex container for {@link StatTile}s — a row on wide, wraps on narrow. */
export function StatRow({ children, style }: StatRowProps) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 120,
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: borders.thin,
  },
});
