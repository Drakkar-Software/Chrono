import { Host, Picker as UIPicker, Text as UIText } from '@expo/ui/swift-ui';
import { pickerStyle, tag, tint } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme';
import { useTheme } from '../use-theme';
import { Txt } from './Txt';

import type { PickerProps } from './Picker.types';

/**
 * Native select built on `@expo/ui` `Picker` inside a `Host` (a menu-style
 * picker). Selection is driven by each option's `tag` value. Props kept minimal
 * against the `@expo/ui` surface.
 */
export function Picker({ label, value, onValueChange, options, disabled = false }: PickerProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? (
        <Txt variant="label" tone="textMuted">
          {label}
        </Txt>
      ) : null}
      <Host matchContents>
        <UIPicker
          selection={value}
          onSelectionChange={(selection: string) => {
            if (!disabled) onValueChange(selection);
          }}
          modifiers={[pickerStyle('menu'), tint(colors.accent)]}
        >
          {options.map((o) => (
            <UIText key={o.value} modifiers={[tag(o.value)]}>
              {o.label}
            </UIText>
          ))}
        </UIPicker>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
});
