import { Pressable, StyleSheet, View } from 'react-native';
import { Txt, spacing, useTheme } from '@chrono/ui';
import { formatDuration } from '@chrono/sdk';
import type { TimeOff } from '@chrono/sdk';
import { useT } from '@/lib/i18n';

export interface TimeOffRowProps {
  timeOff: TimeOff;
  onPress?: () => void;
}

/** One time-off day: kind + optional note on the left, date/duration on the right. */
export function TimeOffRow({ timeOff, onPress }: TimeOffRowProps) {
  const t = useT();
  const { colors } = useTheme();
  const durationLabel =
    timeOff.duration_minutes != null
      ? formatDuration(timeOff.duration_minutes)
      : t('comp.timeOff.fullDay');

  return (
    <Pressable
      onPress={onPress}
      disabled={onPress == null}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed && onPress ? colors.hover : 'transparent' },
      ]}
    >
      <View style={styles.left}>
        <Txt variant="bodyMedium" numberOfLines={1}>
          {t(`comp.timeOff.kind.${timeOff.kind}`)}
        </Txt>
        {timeOff.note ? (
          <Txt variant="caption" tone="textMuted" numberOfLines={1}>
            {timeOff.note}
          </Txt>
        ) : null}
      </View>
      <View style={styles.right}>
        <Txt variant="bodyMedium" mono tabularNums>
          {durationLabel}
        </Txt>
        <Txt variant="caption" tone="textMuted" mono>
          {timeOff.off_date.slice(0, 10)}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    minHeight: 52,
  },
  left: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: spacing.xs },
});
