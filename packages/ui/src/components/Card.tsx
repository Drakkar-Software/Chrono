import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { borders, elevation, radii, spacing, type ShadowLevel } from '../theme';
import { useTheme } from '../use-theme';

export interface CardProps {
  children: ReactNode;
  /** Inner padding from the spacing scale. Default `lg`. */
  padding?: keyof typeof spacing;
  /** Use the most-elevated surface token. Default false (`surface`). */
  raised?: boolean;
  /** Drop-shadow level. Default `none`. */
  shadow?: ShadowLevel;
  style?: StyleProp<ViewStyle>;
}

/** Themed surface container with padding, radius and a hairline border. */
export function Card({ children, padding = 'lg', raised = false, shadow = 'none', style }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: raised ? colors.surfaceRaised : colors.surface,
          borderColor: colors.border,
          padding: spacing[padding],
        },
        elevation(shadow),
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    borderWidth: borders.thin,
  },
});
