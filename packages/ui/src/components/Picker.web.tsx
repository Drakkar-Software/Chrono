import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { borders, layout, opacity, radii, spacing } from '../theme';
import { useTheme } from '../use-theme';
import { Txt } from './Txt';

import type { PickerProps } from './Picker.types';

/**
 * Web / react-native-web select — a themed pressable that opens a modal option
 * list. Fully functional without `@expo/ui`.
 */
export function Picker({ label, value, onValueChange, options, placeholder = 'Select…', disabled = false }: PickerProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrap}>
      {label ? (
        <Txt variant="label" tone="textMuted">
          {label}
        </Txt>
      ) : null}
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={[
          styles.control,
          { borderColor: colors.border, backgroundColor: colors.surface, opacity: disabled ? opacity.disabled : 1 },
        ]}
      >
        <Txt variant="body" tone={selected ? 'text' : 'textFaint'} numberOfLines={1} style={styles.controlText}>
          {selected ? selected.label : placeholder}
        </Txt>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
            <ScrollView>
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => {
                      onValueChange(o.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      { backgroundColor: active ? colors.accentBg : pressed ? colors.hover : 'transparent' },
                    ]}
                  >
                    <Txt variant="body" tone={active ? 'accent' : 'text'} style={styles.optionText}>
                      {o.label}
                    </Txt>
                    {active ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.controlMinHeight,
    borderWidth: borders.thin,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  controlText: { flex: 1 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '70%',
    borderWidth: borders.thin,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  optionText: { flex: 1 },
});
