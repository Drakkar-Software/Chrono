import { Host, Picker as UIPicker } from '@expo/ui/swift-ui';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../use-theme';

import type { SegmentedProps } from './Segmented.types';

/**
 * Native segmented control built on `@expo/ui` `Picker` with the `segmented`
 * variant, inside a `Host`. The option index is bridged to/from our
 * `{label,value}` list. Props kept minimal against the alpha `@expo/ui` surface.
 */
export function Segmented({ options, value, onValueChange, disabled = false }: SegmentedProps) {
  const { colors } = useTheme();
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <View style={styles.wrap}>
      <Host matchContents>
        <UIPicker
          variant="segmented"
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
  wrap: { width: '100%' },
});
