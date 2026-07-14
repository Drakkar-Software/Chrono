import type { TextProps } from 'react-native';
import { StyleSheet, Text } from 'react-native';

import { fonts, type as typeScale, weights, type TypeVariant, type WeightName } from '../theme';
import { useTheme, type Palette } from '../use-theme';

export interface TxtProps extends TextProps {
  /** Type-scale step (font size + line height + default weight). */
  variant?: TypeVariant;
  /** Override the variant's default weight. */
  weight?: WeightName;
  /** Render in the monospace family (timestamps, durations, codes, amounts). */
  mono?: boolean;
  /** Palette token to color the text (e.g. "textMuted", "accent"). */
  tone?: keyof Palette;
  /** Explicit color — wins over `tone`. */
  color?: string;
  /** `fontVariant: ['tabular-nums']` — prevents layout shift as numbers tick. */
  tabularNums?: boolean;
  uppercase?: boolean;
  center?: boolean;
}

/**
 * The kit's single text primitive. Every label, title and paragraph renders
 * through here so type scale, font family and theme color stay consistent.
 */
export function Txt({
  variant = 'body',
  weight,
  mono = false,
  tone,
  color,
  tabularNums = false,
  uppercase = false,
  center = false,
  style,
  ...rest
}: TxtProps) {
  const { colors } = useTheme();
  const { fontSize, lineHeight, fontWeight } = typeScale[variant];
  const resolved = color ?? (tone ? colors[tone] : colors.text);
  return (
    <Text
      {...rest}
      style={[
        styles.base,
        {
          fontFamily: mono ? fonts.mono : fonts.body,
          fontSize,
          lineHeight,
          fontWeight: weight ? weights[weight] : fontWeight,
          color: resolved,
          letterSpacing: uppercase ? 0.6 : 0,
          textTransform: uppercase ? 'uppercase' : 'none',
          textAlign: center ? 'center' : 'left',
          fontVariant: tabularNums ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  } as const,
});
