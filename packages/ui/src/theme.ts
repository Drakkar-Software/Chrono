/**
 * Chrono design tokens — the SINGLE source of truth for the whole UI kit.
 *
 * Every color, font, size, radius and shadow lives here. Components must NEVER
 * hardcode a hex / size / font or compute `rgba()` inline — import from this
 * file (usually via `useTheme()` in `./use-theme`) so light/dark stay in sync
 * and the "precision ledger instrument" identity holds. Alpha variants are
 * pre-derived into named tokens (accentBg, accentBorder, hover…) rather than
 * mixed at call sites.
 *
 * Identity: warm graphite ground, brass as a RARE brand/primary-action accent.
 * Brass never touches success/warning/danger/info — money is expressed by
 * type (tabular mono) and by direction color (moneyIn/moneyOut), not by hue.
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
  /** Hairline under aligned tabular figures — the "ledger" signifier. */
  ledgerRule: string;

  // ── Accent (brass) — brand + primary action ONLY, never status ───────────
  /** Primary accent fill. */
  accent: string;
  /** Pressed/hover-darkened accent. */
  accentStrong: string;
  /** Readable text/icon sitting directly on `accent` (dark ink on brass — "engraved plate"). */
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

  // ── Money direction — the ledger's in/out tint (aliases of success/danger,
  //    named so "direction color" is a rule, not an ad-hoc choice at call sites) ──
  moneyIn: string;
  moneyOut: string;

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
  canvas: '#f3f2ef',
  surface: '#fbfaf8',
  surfaceRaised: '#ffffff',
  fill: '#e9e7e1',

  text: '#211f1b',
  textMuted: '#5c584f',
  textFaint: '#8a857a',

  border: '#ded9cf',
  borderStrong: '#c3bcad',
  ledgerRule: 'rgba(33,31,27,0.06)',

  accent: '#8a6a2f',
  accentStrong: '#71551f',
  accentText: '#fbfaf8',
  accentBg: 'rgba(138,106,47,0.10)',
  accentBgStrong: 'rgba(138,106,47,0.16)',
  accentBorder: 'rgba(138,106,47,0.32)',

  success: '#1f7a4d',
  successBg: 'rgba(31,122,77,0.12)',
  warning: '#b7791f',
  warningBg: 'rgba(183,121,31,0.12)',
  danger: '#b23b2e',
  dangerBg: 'rgba(178,59,46,0.10)',
  info: '#2c5aa8',
  infoBg: 'rgba(44,90,168,0.10)',

  moneyIn: '#1f7a4d',
  moneyOut: '#b23b2e',

  hover: 'rgba(33,31,27,0.05)',
  pressed: 'rgba(33,31,27,0.09)',
  disabledFill: 'rgba(33,31,27,0.06)',
  focusRing: '#8a6a2f',

  overlay: 'rgba(33,31,27,0.45)',
  onOverlay: '#fbfaf8',
  skeleton: '#e6e3db',
};

const dark: Palette = {
  canvas: '#16150f',
  surface: '#1f1d16',
  surfaceRaised: '#28251c',
  fill: '#302c22',

  text: '#ede9de',
  textMuted: '#a8a292',
  textFaint: '#6c6656',

  border: '#332f25',
  borderStrong: '#48412f',
  ledgerRule: 'rgba(237,233,222,0.08)',

  accent: '#c7a15a',
  accentStrong: '#dab876',
  accentText: '#16150f',
  accentBg: 'rgba(199,161,90,0.14)',
  accentBgStrong: 'rgba(199,161,90,0.22)',
  accentBorder: 'rgba(199,161,90,0.36)',

  success: '#4cb782',
  successBg: 'rgba(76,183,130,0.14)',
  warning: '#e0a93e',
  warningBg: 'rgba(224,169,62,0.14)',
  danger: '#e4736a',
  dangerBg: 'rgba(228,115,106,0.14)',
  info: '#6d9de8',
  infoBg: 'rgba(109,157,232,0.14)',

  moneyIn: '#4cb782',
  moneyOut: '#e4736a',

  hover: 'rgba(237,233,222,0.06)',
  pressed: 'rgba(237,233,222,0.10)',
  disabledFill: 'rgba(237,233,222,0.06)',
  focusRing: '#c7a15a',

  overlay: 'rgba(0,0,0,0.60)',
  onOverlay: '#ede9de',
  skeleton: '#2b2820',
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

/**
 * Type scale: each step carries `{fontSize, lineHeight, fontWeight, letterSpacing}`.
 * Tracking is negative at display sizes (optical tightening), neutral in body,
 * and positive only for uppercase "eyebrow" labels (applied by `<Txt uppercase>`
 * on top of a step's own tracking) — the engraved-instrument-label register.
 */
export const type = {
  displayXl: { fontSize: 60, lineHeight: 64, fontWeight: '700' as Weight, letterSpacing: -1.2 },
  displayLg: { fontSize: 40, lineHeight: 46, fontWeight: '700' as Weight, letterSpacing: -0.8 },
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' as Weight, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as Weight, letterSpacing: -0.3 },
  heading: { fontSize: 17, lineHeight: 23, fontWeight: '600' as Weight, letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as Weight, letterSpacing: 0 },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: '500' as Weight, letterSpacing: 0 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as Weight, letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as Weight, letterSpacing: 0 },
  micro: { fontSize: 10, lineHeight: 13, fontWeight: '600' as Weight, letterSpacing: 0 },
} as const;

export type TypeVariant = keyof typeof type;

/** Extra positive tracking applied by `<Txt uppercase>` — the eyebrow register. */
export const trackingUppercase = 0.8;

/** Named weights → RN `fontWeight` values (also the vocabulary for `fontFamilies`). */
export const weights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, Weight>;

export type WeightName = keyof typeof weights;

const weightNameByNumber: Record<string, WeightName> = {
  '400': 'regular',
  '500': 'medium',
  '600': 'semibold',
  '700': 'bold',
};

/** Resolve a numeric/string `fontWeight` (as stored per `type` step) back to its weight name. */
export function weightNameFor(fontWeight: Weight | undefined): WeightName {
  if (fontWeight == null) return 'regular';
  return weightNameByNumber[String(fontWeight)] ?? 'regular';
}

export type FontRole = 'display' | 'body' | 'mono';

/**
 * Self-hosted Geist (display + body) and Geist Mono (all numerics) — one
 * registered family PER WEIGHT, since native text doesn't synthesize weight
 * from a numeric `fontWeight` the way CSS does. Web registers the same family
 * names via `@font-face` in `+html.tsx` at `font-weight: normal`, so on both
 * platforms the family name alone selects the face — components should read
 * weight through `fontFamilyFor()`, never set a numeric `fontWeight` for text.
 */
export const fontFamilies: Record<FontRole, Record<WeightName, string>> = {
  display: {
    regular: 'Geist-Regular',
    medium: 'Geist-Medium',
    semibold: 'Geist-SemiBold',
    bold: 'Geist-Bold',
  },
  body: {
    regular: 'Geist-Regular',
    medium: 'Geist-Medium',
    semibold: 'Geist-SemiBold',
    bold: 'Geist-Bold',
  },
  mono: {
    regular: 'GeistMono-Regular',
    medium: 'GeistMono-Medium',
    semibold: 'GeistMono-SemiBold',
    bold: 'GeistMono-Bold',
  },
} as const;

/** Resolve the registered family name for a (role, weight) pair. */
export function fontFamilyFor(role: FontRole, weight: WeightName): string {
  return fontFamilies[role][weight];
}

/**
 * @deprecated Prefer `fontFamilyFor(role, weight)` — kept only for the rare
 * caller that needs a bare family name outside `<Txt>` (e.g. a raw web
 * `<input>`). Resolves each role's regular weight.
 */
export const fonts = {
  display: fontFamilies.display.regular,
  heading: fontFamilies.display.medium,
  body: fontFamilies.body.regular,
  bodyMedium: fontFamilies.body.medium,
  mono: fontFamilies.mono.regular,
} as const;

/** Cross-platform elevation presets (react-native-web maps these to boxShadow). */
export const shadows = {
  none: {},
  sm: {
    shadowColor: '#1a1712',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#1a1712',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  lg: {
    shadowColor: '#1a1712',
    shadowOpacity: 0.26,
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
  /** Wider cap for grid/dashboard screens (card lists) — opt in via `StackScreen wide`. */
  maxContentWidthWide: 1100,
  /** At/above this viewport width the UI switches to the wide/desktop layout. */
  breakpointDesktop: 900,
  /** Minimum tappable control height. */
  controlMinHeight: 48,
  /** Standard header height. */
  headerMinHeight: 52,
  /** Default horizontal screen padding. */
  screenX: 18,
} as const;

/** Named control heights — replaces per-component hardcoded 44/46/52 literals. */
export const controlHeight = {
  sm: 36,
  md: 44,
  lg: 52,
} as const;

/**
 * Motion — "needle settle": every transition is a single well-damped spring
 * that slightly overshoots then settles, never a linear ease and never a
 * loop. Reserve motion for real state change (submit, settle, expand), not
 * idle decoration. `AccessibilityInfo.isReduceMotionEnabled()` should still
 * gate every non-essential animation at the call site.
 */
export const motion = {
  duration: {
    fast: 150,
    base: 220,
    slow: 320,
  },
  spring: {
    /** The default "needle settle" spring — state-change transitions, sheets, layout. */
    settle: { stiffness: 180, damping: 22, mass: 1 },
    /** Snappier variant for small, frequent interactions (press feedback, chip toggle). */
    snap: { stiffness: 260, damping: 24, mass: 0.8 },
  },
} as const;

export interface Theme {
  scheme: ColorScheme;
  colors: Palette;
}
