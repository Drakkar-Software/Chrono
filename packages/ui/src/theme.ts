/**
 * Chrono design tokens — the SINGLE source of truth for the whole UI kit.
 *
 * Every color, font, size, radius and shadow lives here. Components must NEVER
 * hardcode a hex / size / font or compute `rgba()` inline — import from this
 * file (usually via `useTheme()` in `./use-theme`) so light/dark stay in sync
 * and the "chronograph" indigo identity holds. Alpha variants are pre-derived
 * into named tokens (accentBg, accentBorder, hover…) rather than mixed at call
 * sites.
 */
import { Platform, type TextStyle } from 'react-native';

export type ColorScheme = 'light' | 'dark';

/**
 * The full palette contract. Both `light` and `dark` implement every token, so
 * a component reading `colors.accentBg` is guaranteed a value in either scheme.
 */
export interface Palette {
  // ── Surfaces ──────────────────────────────────────────────────────────────
  /** App backdrop, behind everything. */
  canvas: string;
  /** Standard raised surface — cards, rows, inputs. */
  surface: string;
  /** Most-elevated surface — sheets, popovers, modals. */
  surfaceRaised: string;
  /** Recessed neutral fill (skeletons, avatars, inset wells). */
  fill: string;

  // ── Ink (text + icons), strongest → faintest ──────────────────────────────
  text: string;
  textMuted: string;
  textFaint: string;

  // ── Lines & dividers ──────────────────────────────────────────────────────
  border: string;
  borderStrong: string;

  // ── Accent (indigo chronograph) ───────────────────────────────────────────
  /** Primary accent fill. */
  accent: string;
  /** Pressed/hover-darkened accent. */
  accentStrong: string;
  /** Readable text/icon sitting directly on `accent`. */
  accentText: string;
  /** Translucent accent tint for soft backgrounds (chips, selected rows). */
  accentBg: string;
  /** Stronger translucent accent tint. */
  accentBgStrong: string;
  /** Translucent accent border. */
  accentBorder: string;

  // ── Status ────────────────────────────────────────────────────────────────
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  info: string;
  infoBg: string;

  // ── Interaction states ────────────────────────────────────────────────────
  /** Translucent wash under a hovered control/row. */
  hover: string;
  /** Translucent wash on an actively pressed control. */
  pressed: string;
  /** Neutral fill for a disabled control (pairs with `opacity.disabled`). */
  disabledFill: string;
  /** Keyboard-focus ring color (web :focus-visible). */
  focusRing: string;

  // ── Overlays & loading ────────────────────────────────────────────────────
  /** Scrim behind modals / sheets. */
  overlay: string;
  /** Foreground (text/icons) drawn on top of `overlay` — light in both schemes. */
  onOverlay: string;
  /** Skeleton placeholder fill. */
  skeleton: string;
}

const light: Palette = {
  canvas: '#eef0f8',
  surface: '#ffffff',
  surfaceRaised: '#f9fafd',
  fill: '#e4e7f1',

  text: '#1b1f2e',
  textMuted: '#5a6172',
  textFaint: '#9aa0b3',

  border: '#dcdfea',
  borderStrong: '#c2c7d6',

  accent: '#4f46e5',
  accentStrong: '#4338ca',
  accentText: '#ffffff',
  accentBg: 'rgba(79,70,229,0.10)',
  accentBgStrong: 'rgba(79,70,229,0.16)',
  accentBorder: 'rgba(79,70,229,0.30)',

  success: '#0f9d6e',
  successBg: 'rgba(15,157,110,0.12)',
  warning: '#b7791f',
  warningBg: 'rgba(183,121,31,0.12)',
  danger: '#dc2626',
  dangerBg: 'rgba(220,38,38,0.10)',
  info: '#2563eb',
  infoBg: 'rgba(37,99,235,0.10)',

  hover: 'rgba(20,22,34,0.05)',
  pressed: 'rgba(20,22,34,0.09)',
  disabledFill: 'rgba(20,22,34,0.06)',
  focusRing: '#4f46e5',

  overlay: 'rgba(20,22,34,0.45)',
  onOverlay: '#f7f8fc',
  skeleton: '#e3e6f0',
};

const dark: Palette = {
  canvas: '#0f1117',
  surface: '#171a23',
  surfaceRaised: '#1e222e',
  fill: '#232735',

  text: '#e7e9f2',
  textMuted: '#a0a5b8',
  textFaint: '#5f6578',

  border: '#272b38',
  borderStrong: '#363b4c',

  accent: '#818cf8',
  accentStrong: '#a5b0ff',
  accentText: '#0d0f16',
  accentBg: 'rgba(129,140,248,0.14)',
  accentBgStrong: 'rgba(129,140,248,0.22)',
  accentBorder: 'rgba(129,140,248,0.34)',

  success: '#34d399',
  successBg: 'rgba(52,211,153,0.14)',
  warning: '#fbbf24',
  warningBg: 'rgba(251,191,36,0.14)',
  danger: '#f87171',
  dangerBg: 'rgba(248,113,113,0.14)',
  info: '#60a5fa',
  infoBg: 'rgba(96,165,250,0.14)',

  hover: 'rgba(231,233,242,0.06)',
  pressed: 'rgba(231,233,242,0.10)',
  disabledFill: 'rgba(231,233,242,0.06)',
  focusRing: '#818cf8',

  overlay: 'rgba(0,0,0,0.60)',
  onOverlay: '#f7f8fc',
  skeleton: '#222634',
};

export const colors: Record<ColorScheme, Palette> = { light, dark };

/** 4px spacing scale. */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/** Border-width scale — use instead of inline `borderWidth` literals. */
export const borders = {
  hairline: 0.5,
  thin: 1,
  thick: 1.5,
} as const;

type Weight = TextStyle['fontWeight'];

/** Type scale: each step carries `{fontSize, lineHeight, fontWeight}`. */
export const type = {
  displayLg: { fontSize: 40, lineHeight: 46, fontWeight: '700' as Weight },
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' as Weight },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as Weight },
  heading: { fontSize: 17, lineHeight: 23, fontWeight: '600' as Weight },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as Weight },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: '500' as Weight },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as Weight },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as Weight },
  micro: { fontSize: 10, lineHeight: 13, fontWeight: '600' as Weight },
} as const;

export type TypeVariant = keyof typeof type;

/**
 * Font families by role. Chrono ships no custom fonts — these map to the
 * platform system stack so text renders natively everywhere. Weight is carried
 * separately via the `type` scale / the `<Txt weight>` prop.
 */
export const fonts = {
  display: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'system-ui' }),
  heading: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'system-ui' }),
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' }),
  bodyMedium: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, SFMono-Regular, Menlo, monospace' }),
} as const;

export type FontRole = keyof typeof fonts;

/** Named weights → RN `fontWeight` values. */
export const weights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, Weight>;

export type WeightName = keyof typeof weights;

/** Cross-platform elevation presets (react-native-web maps these to boxShadow). */
export const shadows = {
  none: {},
  sm: {
    shadowColor: '#0b0e1a',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#0b0e1a',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  lg: {
    shadowColor: '#0b0e1a',
    shadowOpacity: 0.24,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
} as const;

export type ShadowLevel = keyof typeof shadows;

/** Return a shadow preset by level. Keeps call sites off the raw `shadows` map. */
export function elevation(level: ShadowLevel = 'sm') {
  return shadows[level];
}

export const opacity = {
  /** Dimmed pressable/control while disabled or blocked by an async action. */
  disabled: 0.45,
  /** De-emphasized content that is still present. */
  muted: 0.6,
} as const;

export const layout = {
  /** Cap reading width on large/web screens. */
  maxContentWidth: 720,
  /** At/above this viewport width the UI switches to the wide/desktop layout. */
  breakpointDesktop: 900,
  /** Minimum tappable control height. */
  controlMinHeight: 48,
  /** Standard header height. */
  headerMinHeight: 52,
  /** Default horizontal screen padding. */
  screenX: 18,
} as const;

export interface Theme {
  scheme: ColorScheme;
  colors: Palette;
}
