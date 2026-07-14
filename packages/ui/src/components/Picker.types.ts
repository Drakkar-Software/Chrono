export interface PickerOption {
  label: string;
  value: string;
}

export interface PickerProps {
  /** Field label rendered above the control. */
  label?: string;
  /** Currently selected value (must match one option's `value`). */
  value: string;
  onValueChange: (value: string) => void;
  options: PickerOption[];
  /** Shown when `value` matches no option. */
  placeholder?: string;
  disabled?: boolean;
}
