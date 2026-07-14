import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { radii } from '../theme';
import { useTheme, type Palette } from '../use-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface IconBadgeProps {
  /** Ionicons glyph name. */
  name: IoniconName;
  /** Container edge length in px. Default 36. */
  size?: number;
  /** Glyph palette token. Default `accent`. */
  tone?: keyof Palette;
  /** Background palette token. Default `accentBg`. */
  background?: keyof Palette;
  /** `circle` (default) or `rounded` (radii.md). */
  shape?: 'circle' | 'rounded';
}

/**
 * A tinted, centered icon chip — the recurring "avatar-style" glyph badge used
 * on activity/notification/project rows. Sizes and colors come from the theme.
 */
export function IconBadge({
  name,
  size = 36,
  tone = 'accent',
  background = 'accentBg',
  shape = 'circle',
}: IconBadgeProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: shape === 'circle' ? radii.pill : radii.md,
          backgroundColor: colors[background],
        },
      ]}
    >
      <Ionicons name={name} size={Math.round(size * 0.5)} color={colors[tone]} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
