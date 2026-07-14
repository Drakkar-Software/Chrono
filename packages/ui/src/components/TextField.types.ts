import type { KeyboardTypeOptions } from 'react-native';

export interface TextFieldProps {
  /** Field label rendered above the input. */
  label?: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  /** Error message rendered below the input (also tints the border). */
  error?: string;
  /** Mask input (passwords). */
  secureTextEntry?: boolean;
  /** Auto-capitalization behavior. Default `sentences`. */
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  multiline?: boolean;
}
