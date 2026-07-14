import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { borders, opacity, spacing } from '../theme';
import { useTheme } from '../use-theme';
import { Txt } from './Txt';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  /** Leading node (avatar, icon). */
  leading?: ReactNode;
  /** Trailing node — overrides the default chevron when `onPress` is set. */
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Draw a hairline divider under the row. Default true. */
  divider?: boolean;
}

/** Pressable list row with leading/trailing slots + title/subtitle. */
export function ListItem({ title, subtitle, leading, trailing, onPress, disabled = false, divider = true }: ListItemProps) {
  const { colors } = useTheme();
  const showChevron = onPress != null && trailing == null;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || onPress == null}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.row,
        divider && { borderBottomColor: colors.border, borderBottomWidth: borders.hairline },
        { backgroundColor: pressed && onPress ? colors.hover : 'transparent', opacity: disabled ? opacity.disabled : 1 },
      ]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>
        <Txt variant="bodyMedium" numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" tone="textMuted" numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {trailing ? (
        <View style={styles.trailing}>{trailing}</View>
      ) : showChevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  leading: { flexShrink: 0 },
  body: { flex: 1, gap: 2 },
  trailing: { flexShrink: 0 },
});
