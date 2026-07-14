import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { opacity, radii, spacing } from '../theme';
import { useTheme, type Palette } from '../use-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface IconButtonProps {
  /** Ionicons glyph name (e.g. "chevron-back", "add", "close"). */
  name: IoniconName;
  onPress?: () => void;
  /** Glyph size in px. Default 22. */
  size?: number;
  /** Palette token for the glyph color. Default `text`. */
  tone?: keyof Palette;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/** Small pressable icon with a themed hover/press wash. */
export function IconButton({ name, onPress, size = 22, tone = 'text', disabled = false, accessibilityLabel }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? colors.pressed : 'transparent', opacity: disabled ? opacity.disabled : 1 },
      ]}
    >
      <Ionicons name={name} size={size} color={colors[tone]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
});
