import { Host, DatePicker as UIDatePicker } from '@expo/ui/swift-ui';
import { disabled as disabledModifier, tint } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme';
import { useTheme } from '../use-theme';
import { Txt } from './Txt';

import type { DatePickerProps } from './DatePicker.types';

/**
 * Native date picker built on `@expo/ui` `DatePicker` inside a `Host`. Emits a
 * JS `Date` on selection. Props kept minimal against the `@expo/ui` surface.
 */
export function DatePicker({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  disabled = false,
}: DatePickerProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? (
        <Txt variant="label" tone="textMuted">
          {label}
        </Txt>
      ) : null}
      <Host matchContents>
        <UIDatePicker
          selection={value}
          displayedComponents={['date']}
          range={
            minimumDate || maximumDate
              ? { start: minimumDate, end: maximumDate }
              : undefined
          }
          onDateChange={(date: Date) => onChange(date)}
          modifiers={[tint(colors.accent), disabledModifier(disabled)]}
        />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
});
