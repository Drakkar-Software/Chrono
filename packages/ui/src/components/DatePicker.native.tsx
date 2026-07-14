import { Host, DateTimePicker } from '@expo/ui/swift-ui';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme';
import { useTheme } from '../use-theme';
import { Txt } from './Txt';

import type { DatePickerProps } from './DatePicker.types';

/**
 * Native date picker built on `@expo/ui` `DateTimePicker` inside a `Host`.
 * Emits a JS `Date` on selection. Props kept minimal against the alpha
 * `@expo/ui` surface.
 */
export function DatePicker({ label, value, onChange, disabled = false }: DatePickerProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? (
        <Txt variant="label" tone="textMuted">
          {label}
        </Txt>
      ) : null}
      <Host matchContents>
        <DateTimePicker
          variant="automatic"
          displayedComponents="date"
          initialDate={value.toISOString()}
          color={colors.accent}
          disabled={disabled}
          onDateSelected={(date: Date) => onChange(date)}
        />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
});
