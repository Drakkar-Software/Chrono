import { Host, TextField as UITextField } from '@expo/ui/swift-ui';
import { StyleSheet, View } from 'react-native';

import { borders, layout, radii, spacing } from '../theme';
import { useTheme } from '../use-theme';
import { Txt } from './Txt';

import type { TextFieldProps } from './TextField.types';

/**
 * Native labeled input built on `@expo/ui` `TextField` inside a `Host`. Label
 * and error are themed RN text so the field matches the web layout. Props are
 * kept minimal against the alpha `@expo/ui` surface.
 */
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
        <Txt variant="label" tone="textMuted">
          {label}
        </Txt>
      ) : null}
      <View
        style={[
          styles.field,
          {
            borderColor,
            backgroundColor: colors.surface,
            minHeight: multiline ? layout.controlMinHeight * 2 : layout.controlMinHeight,
          },
        ]}
      >
        <Host matchContents>
          <UITextField
            defaultValue={value}
            placeholder={placeholder}
            keyboardType={keyboardType}
            multiline={multiline}
            secure={secureTextEntry}
            autocapitalize={autoCapitalize}
            editable={editable}
            onChangeText={onChangeText}
            color={colors.text}
          />
        </Host>
      </View>
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  field: {
    borderWidth: borders.thin,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
});
