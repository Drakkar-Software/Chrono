import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, Txt, spacing, useTheme } from '@chrono/ui';
import { formatDuration } from '@chrono/sdk';
import type { TimeEntryWithProject } from '@chrono/sdk';
import { timeEntryBadge } from '@/lib/status';

export interface TimeEntryRowProps {
  entry: TimeEntryWithProject;
  onPress?: () => void;
}

/** One time entry: project + description on the left, duration + status right. */
export function TimeEntryRow({ entry, onPress }: TimeEntryRowProps) {
  const { colors } = useTheme();
  const projectName = entry.project?.name ?? 'Project';
  const statusLabel = entry.status.charAt(0).toUpperCase() + entry.status.slice(1);

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
          {projectName}
        </Txt>
        {entry.description ? (
          <Txt variant="caption" tone="textMuted" numberOfLines={1}>
            {entry.description}
          </Txt>
        ) : null}
      </View>
      <View style={styles.right}>
        <Txt variant="bodyMedium" mono tabularNums>
          {formatDuration(entry.duration_minutes)}
        </Txt>
        <Badge label={statusLabel} status={timeEntryBadge(entry.status)} />
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
