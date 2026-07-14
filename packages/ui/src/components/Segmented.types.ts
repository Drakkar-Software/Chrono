export interface SegmentedOption {
  label: string;
  value: string;
}

export interface SegmentedProps {
  /** The small set of choices. */
  options: SegmentedOption[];
  /** Selected value. */
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}
