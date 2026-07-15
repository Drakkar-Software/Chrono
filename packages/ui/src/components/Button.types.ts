export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  /** Visual style. Default `primary`. */
  variant?: ButtonVariant;
  /** Control height / padding preset. Default `md`. */
  size?: ButtonSize;
  disabled?: boolean;
  /** Show a spinner and block presses. */
  loading?: boolean;
  /** Stretch to the container width. Default false. */
  fullWidth?: boolean;
  /** Center the button itself (instead of shrink-wrapping to the start edge) — for placement under centered text/content. Default false. */
  center?: boolean;
}
