import { StyleSheet, TextInput, View } from 'react-native';

import { borders, layout, opacity, radii, spacing, type as typeScale } from '../theme';
import { useTheme } from '../use-theme';
import { Txt } from './Txt';

import type { TextFieldProps } from './TextField.types';

/** Web / react-native-web labeled text input. Fully functional without `@expo/ui`. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  error,
  secureTextEntry = false,
  autoCapitalize = 'sentences',
  editable = true,
  multiline = false,
}: TextFieldProps) {
  const { colors } = useTheme();
  const borderColor = error ? colors.danger : colors.border;
  return (
    <View style={styles.wrap}>
      {label ? (
        <Txt variant="label" tone="textMuted" style={styles.label}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        editable={editable}
        multiline={multiline}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor,
            minHeight: multiline ? layout.controlMinHeight * 2 : layout.controlMinHeight,
            opacity: editable ? 1 : opacity.disabled,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
      {error ? (
        <Txt variant="caption" tone="danger" style={styles.error}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {},
  input: {
    borderWidth: borders.thin,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typeScale.body.fontSize,
  },
  error: {},
});
