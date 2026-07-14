export interface DatePickerProps {
  /** Field label rendered above the control. */
  label?: string;
  /** Currently selected date. */
  value: Date;
  onChange: (date: Date) => void;
  /** Earliest selectable date. */
  minimumDate?: Date;
  /** Latest selectable date. */
  maximumDate?: Date;
  disabled?: boolean;
}
