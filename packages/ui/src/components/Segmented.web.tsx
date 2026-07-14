import { Pressable, StyleSheet, View } from 'react-native';

import { borders, opacity, radii, spacing } from '../theme';
import { useTheme } from '../use-theme';
import { Txt } from './Txt';

import type { SegmentedProps } from './Segmented.types';

/**
 * Web / react-native-web segmented control — a themed row of pressables with
 * the active segment filled. Fully functional without `@expo/ui`.
 */
export function Segmented({ options, value, onValueChange, disabled = false }: SegmentedProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.fill, borderColor: colors.border, opacity: disabled ? opacity.disabled : 1 }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            disabled={disabled}
            onPress={() => onValueChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Txt variant="label" tone={active ? 'accent' : 'textMuted'} center numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: spacing.xs / 2,
    borderRadius: radii.md,
    borderWidth: borders.hairline,
    gap: spacing.xs / 2,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: borders.hairline,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
