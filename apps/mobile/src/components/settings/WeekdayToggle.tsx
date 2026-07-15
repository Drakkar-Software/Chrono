import { Pressable, StyleSheet, View } from 'react-native';
import { Txt, borders, radii, spacing, useTheme } from '@chrono/ui';
import { useT } from '@/lib/i18n';

const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export interface WeekdayToggleProps {
  /** ISO weekday numbers (1=Mon..7=Sun) currently selected as working days. */
  value: number[];
  onChange: (value: number[]) => void;
  disabled?: boolean;
}

/** Seven single-letter toggle chips (M T W T F S S) for picking working weekdays. */
export function WeekdayToggle({ value, onChange, disabled = false }: WeekdayToggleProps) {
  const t = useT();
  const { colors } = useTheme();
  const labels: Record<number, string> = {
    1: t('comp.weekday.monShort'),
    2: t('comp.weekday.tueShort'),
    3: t('comp.weekday.wedShort'),
    4: t('comp.weekday.thuShort'),
    5: t('comp.weekday.friShort'),
    6: t('comp.weekday.satShort'),
    7: t('comp.weekday.sunShort'),
  };

  const toggle = (day: number) => {
    if (disabled) return;
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b));
  };

  return (
    <View style={styles.row}>
      {ISO_WEEKDAYS.map((day) => {
        const active = value.includes(day);
        return (
          <Pressable
            key={day}
            onPress={() => toggle(day)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={labels[day]}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? colors.accentBg : pressed ? colors.hover : colors.surface,
                borderColor: active ? colors.accentBorder : colors.border,
              },
            ]}
          >
            <Txt variant="caption" tone={active ? 'accent' : 'textMuted'}>
              {labels[day]}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: borders.thin,
  },
});
