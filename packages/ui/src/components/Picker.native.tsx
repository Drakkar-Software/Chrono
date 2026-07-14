import { Host, Picker as UIPicker } from '@expo/ui/swift-ui';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme';
import { useTheme } from '../use-theme';
import { Txt } from './Txt';

import type { PickerProps } from './Picker.types';

/**
 * Native select built on `@expo/ui` `Picker` inside a `Host` (a menu-style
 * picker). The option index is bridged to/from our `{label,value}` list. Props
 * kept minimal against the alpha `@expo/ui` surface.
 */
export function Picker({ label, value, onValueChange, options, disabled = false }: PickerProps) {
  const { colors } = useTheme();
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <View style={styles.wrap}>
      {label ? (
        <Txt variant="label" tone="textMuted">
          {label}
        </Txt>
      ) : null}
      <Host matchContents>
        <UIPicker
          variant="menu"
          options={options.map((o) => o.label)}
          selectedIndex={selectedIndex}
          color={colors.accent}
          onOptionSelected={({ nativeEvent: { index } }) => {
            const opt = options[index];
            if (opt && !disabled) onValueChange(opt.value);
          }}
        />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
});
