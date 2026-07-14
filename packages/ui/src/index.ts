/**
 * @chrono/ui — the presentational component kit for the Chrono universal app.
 *
 * Built on `@expo/ui` native primitives with react-native / react-native-web
 * fallbacks (platform-split by file extension), over a single design-token
 * source. No business logic, no data access — components take props + callbacks.
 */

// ── Design tokens ───────────────────────────────────────────────────────────
export {
  colors,
  spacing,
  radii,
  borders,
  type as typeScale,
  fonts,
  weights,
  shadows,
  elevation,
  opacity,
  layout,
} from './theme';
export type {
  Palette,
  ColorScheme,
  Theme,
  TypeVariant,
  FontRole,
  WeightName,
  ShadowLevel,
} from './theme';

// ── Theme provider + hooks ──────────────────────────────────────────────────
export { ThemeProvider, useResponsive } from './provider';
export type { ThemeProviderProps, Responsive } from './provider';
export { useTheme } from './use-theme';

// ── Layout / scaffolding ────────────────────────────────────────────────────
export { Screen } from './components/Screen';
export type { ScreenProps } from './components/Screen';
export { StackScreen } from './components/StackScreen';
export type { StackScreenProps } from './components/StackScreen';

// ── Primitives ──────────────────────────────────────────────────────────────
export { Txt } from './components/Txt';
export type { TxtProps } from './components/Txt';
export { Button } from './components/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button.types';
export { IconButton } from './components/IconButton';
export type { IconButtonProps } from './components/IconButton';
export { Card } from './components/Card';
export type { CardProps } from './components/Card';
export { Row } from './components/Row';
export type { RowProps } from './components/Row';

// ── Forms ───────────────────────────────────────────────────────────────────
export { TextField } from './components/TextField';
export type { TextFieldProps } from './components/TextField.types';
export { Picker } from './components/Picker';
export type { PickerProps, PickerOption } from './components/Picker.types';
export { DatePicker } from './components/DatePicker';
export type { DatePickerProps } from './components/DatePicker.types';
export { Segmented } from './components/Segmented';
export type { SegmentedProps, SegmentedOption } from './components/Segmented.types';

// ── Content / status ────────────────────────────────────────────────────────
export { Badge, Pill } from './components/Badge';
export type { BadgeProps, BadgeStatus, PillProps } from './components/Badge';
export { Money, formatMoney } from './components/Money';
export type { MoneyProps } from './components/Money';
export { EmptyState } from './components/EmptyState';
export type { EmptyStateProps } from './components/EmptyState';
export { ListItem } from './components/ListItem';
export type { ListItemProps } from './components/ListItem';
