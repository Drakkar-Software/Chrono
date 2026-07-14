import { Host, Picker as UIPicker, Text as UIText } from '@expo/ui/swift-ui';
import { pickerStyle, tag, tint } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../use-theme';

import type { SegmentedProps } from './Segmented.types';

/**
 * Native segmented control built on `@expo/ui` `Picker` with the `segmented`
 * style, inside a `Host`. Selection is driven by each option's `tag` value.
 * Props kept minimal against the `@expo/ui` surface.
 */
export function Segmented({ options, value, onValueChange, disabled = false }: SegmentedProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Host matchContents>
        <UIPicker
          selection={value}
          onSelectionChange={(selection: string) => {
            if (!disabled) onValueChange(selection);
          }}
          modifiers={[pickerStyle('segmented'), tint(colors.accent)]}
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
  wrap: { width: '100%' },
});
