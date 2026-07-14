import { borders, radii, spacing } from '../theme';
import type { Palette } from '../use-theme';
import type { ButtonSize, ButtonVariant } from './Button.types';

/** Resolved per-variant colors, shared by the native and web implementations. */
export interface ButtonColors {
  bg: string;
  text: string;
  border: string;
}

export function buttonColors(colors: Palette, variant: ButtonVariant): ButtonColors {
  switch (variant) {
    case 'primary':
      return { bg: colors.accent, text: colors.accentText, border: colors.accent };
    case 'secondary':
      return { bg: colors.accentBg, text: colors.accent, border: colors.accentBorder };
    case 'danger':
      return { bg: colors.danger, text: colors.onOverlay, border: colors.danger };
    case 'ghost':
      return { bg: 'transparent', text: colors.text, border: 'transparent' };
  }
}

export interface ButtonMetrics {
  height: number;
  paddingHorizontal: number;
  fontVariant: 'label' | 'bodyMedium';
  radius: number;
  borderWidth: number;
}

export function buttonMetrics(size: ButtonSize): ButtonMetrics {
  const radius = radii.md;
  const borderWidth = borders.thin;
  switch (size) {
    case 'sm':
      return { height: 44, paddingHorizontal: spacing.md, fontVariant: 'label', radius, borderWidth };
    case 'lg':
      return { height: 52, paddingHorizontal: spacing.xl, fontVariant: 'bodyMedium', radius, borderWidth };
    case 'md':
    default:
      return { height: 46, paddingHorizontal: spacing.lg, fontVariant: 'bodyMedium', radius, borderWidth };
  }
}
