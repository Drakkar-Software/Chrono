import type { TextProps } from 'react-native';
import { Platform, StyleSheet, Text } from 'react-native';

import {
  fontFamilyFor,
  trackingUppercase,
  type as typeScale,
  weightNameFor,
  type FontRole,
  type TypeVariant,
  type WeightName,
} from '../theme';
import { useTheme, type Palette } from '../use-theme';

// react-native-web renders <Text> with `white-space: pre-wrap`, which wraps at
// spaces but lets a long unbreakable token (URLs, emails, VAT ids, long words)
// spill past its container. Break those so text always stays inside its box.
const webWordBreak =
  Platform.OS === 'web'
    ? ({ overflowWrap: 'break-word', wordBreak: 'break-word' } as object)
    : null;

// Headline steps route through the `display` family role, everything else
// through `body` — same Geist family today, but keeps the seam so a future
// distinct display face only needs a change here, not at every call site.
const DISPLAY_VARIANTS = new Set<TypeVariant>(['displayXl', 'displayLg', 'display', 'title', 'heading']);

export interface TxtProps extends TextProps {
  /** Type-scale step (font size + line height + default weight + tracking). */
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
 *
 * Weight is driven entirely by family name (a distinct font file per weight,
 * required for custom fonts on native) — this never emits a numeric RN
 * `fontWeight`, which would do nothing for a custom font and can trigger
 * native faux-bolding.
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
  const step = typeScale[variant];
  const resolved = color ?? (tone ? colors[tone] : colors.text);
  const role: FontRole = mono ? 'mono' : DISPLAY_VARIANTS.has(variant) ? 'display' : 'body';
  const weightName: WeightName = weight ?? weightNameFor(step.fontWeight);
  return (
    <Text
      {...rest}
      style={[
        styles.base,
        webWordBreak,
        {
          fontFamily: fontFamilyFor(role, weightName),
          fontSize: step.fontSize,
          lineHeight: step.lineHeight,
          color: resolved,
          letterSpacing: step.letterSpacing + (uppercase ? trackingUppercase : 0),
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
