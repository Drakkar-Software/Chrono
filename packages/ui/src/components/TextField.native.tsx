import {
  Host,
  SecureField as UISecureField,
  TextField as UITextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

import { borders, layout, radii, spacing } from '../theme';
import { useTheme } from '../use-theme';
import { Txt } from './Txt';

import type { TextFieldProps } from './TextField.types';

/**
 * Native labeled input built on `@expo/ui` `TextField` (or `SecureField` for
 * masked entry) inside a `Host`. Label and error are themed RN text so the field
 * matches the web layout. The text is seeded through an observable state
 * (`useNativeState`) and changes flow back via `onTextChange`.
 *
 * `keyboardType`, `autoCapitalize`, `editable` and `multiline` have no typed
 * equivalent on the native `@expo/ui` field and are honored only on web.
 */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  multiline = false,
}: TextFieldProps) {
  const { colors } = useTheme();
  const textState = useNativeState(value);
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
          {secureTextEntry ? (
            <UISecureField
              text={textState}
              placeholder={placeholder}
              onTextChange={onChangeText}
              modifiers={[foregroundStyle(colors.text)]}
            />
          ) : (
            <UITextField
              text={textState}
              placeholder={placeholder}
              onTextChange={onChangeText}
              modifiers={[foregroundStyle(colors.text)]}
            />
          )}
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
