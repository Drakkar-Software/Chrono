import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { borders, layout, opacity, radii, spacing, type as typeScale } from '../theme';
import { useTheme } from '../use-theme';
import { Txt } from './Txt';

import type { DatePickerProps } from './DatePicker.types';

/** Format a Date as `YYYY-MM-DD` (local). */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse `YYYY-MM-DD` into a local Date, or null if malformed. */
function fromISODate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Web / react-native-web date input — a themed `YYYY-MM-DD` text field. Fully
 * functional without `@expo/ui`. Invalid text is highlighted and not committed.
 */
export function DatePicker({ label, value, onChange, minimumDate, maximumDate, disabled = false }: DatePickerProps) {
  const { colors } = useTheme();
  const [text, setText] = useState(() => toISODate(value));
  const [invalid, setInvalid] = useState(false);

  // Keep the field in sync when the controlled value changes externally.
  useEffect(() => {
    setText(toISODate(value));
    setInvalid(false);
  }, [value]);

  const commit = (next: string) => {
    const parsed = fromISODate(next);
    if (!parsed) {
      setInvalid(next.length > 0);
      return;
    }
    if (minimumDate && parsed < minimumDate) return setInvalid(true);
    if (maximumDate && parsed > maximumDate) return setInvalid(true);
    setInvalid(false);
    onChange(parsed);
  };

  return (
    <View style={styles.wrap}>
      {label ? (
        <Txt variant="label" tone="textMuted">
          {label}
        </Txt>
      ) : null}
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={() => commit(text)}
        onSubmitEditing={() => commit(text)}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textFaint}
        editable={!disabled}
        autoCapitalize="none"
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: invalid ? colors.danger : colors.border,
            opacity: disabled ? opacity.disabled : 1,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  input: {
    minHeight: layout.controlMinHeight,
    borderWidth: borders.thin,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typeScale.body.fontSize,
  },
});
