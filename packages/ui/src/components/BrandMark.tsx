import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { radii, shadows } from '../theme';
import { useTheme } from '../use-theme';

export interface BrandMarkProps {
  /** Container edge length in px. Default 68. */
  size?: number;
  /** Drop a soft shadow under the mark. Default true. */
  shadow?: boolean;
}

/** The Chrono brand mark — an accent rounded square holding the stopwatch glyph. */
export function BrandMark({ size = 68, shadow = true }: BrandMarkProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radii.lg,
          backgroundColor: colors.accent,
        },
        shadow && shadows.md,
      ]}
    >
      <Ionicons name="stopwatch-outline" size={Math.round(size * 0.5)} color={colors.accentText} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
