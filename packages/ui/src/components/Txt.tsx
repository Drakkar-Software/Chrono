import type { TextProps } from 'react-native';
import { Platform, StyleSheet, Text } from 'react-native';

import { fonts, type as typeScale, weights, type TypeVariant, type WeightName } from '../theme';
import { useTheme, type Palette } from '../use-theme';

// react-native-web renders <Text> with `white-space: pre-wrap`, which wraps at
// spaces but lets a long unbreakable token (URLs, emails, VAT ids, long words)
// spill past its container. Break those so text always stays inside its box.
const webWordBreak =
  Platform.OS === 'web'
    ? ({ overflowWrap: 'break-word', wordBreak: 'break-word' } as object)
    : null;

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
        webWordBreak,
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
