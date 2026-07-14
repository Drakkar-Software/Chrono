import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { borders, radii, spacing } from '../theme';
import { useTheme, type Palette } from '../use-theme';
import { Txt } from './Txt';

export type BadgeStatus = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps {
  label: string;
  /** Maps to palette status tokens. Default `neutral`. */
  status?: BadgeStatus;
  style?: StyleProp<ViewStyle>;
}

/** Resolve a status → {foreground, background} pair from the palette. */
function statusColors(colors: Palette, status: BadgeStatus): { fg: string; bg: string } {
  switch (status) {
    case 'accent':
      return { fg: colors.accent, bg: colors.accentBg };
    case 'success':
      return { fg: colors.success, bg: colors.successBg };
    case 'warning':
      return { fg: colors.warning, bg: colors.warningBg };
    case 'danger':
      return { fg: colors.danger, bg: colors.dangerBg };
    case 'info':
      return { fg: colors.info, bg: colors.infoBg };
    case 'neutral':
    default:
      return { fg: colors.textMuted, bg: colors.fill };
  }
}

/** Small status chip. Maps a status string to palette status tokens. */
export function Badge({ label, status = 'neutral', style }: BadgeProps) {
  const { colors } = useTheme();
  const { fg, bg } = statusColors(colors, status);
  return (
    <View style={[styles.base, { backgroundColor: bg }, style]}>
      <Txt variant="micro" weight="semibold" color={fg} uppercase>
        {label}
      </Txt>
    </View>
  );
}

/** Alias of {@link Badge} — a rounded status pill. Identical props. */
export const Pill = Badge;
export type PillProps = BadgeProps;

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.pill,
    borderWidth: borders.hairline,
    borderColor: 'transparent',
  },
});
