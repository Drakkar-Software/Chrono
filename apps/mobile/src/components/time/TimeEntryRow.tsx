import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, Txt, radii, spacing, useTheme } from '@chrono/ui';
import { formatDuration } from '@chrono/sdk';
import type { TimeEntryWithProject } from '@chrono/sdk';
import { timeEntryBadge } from '@/lib/status';
import { useT } from '@/lib/i18n';

export interface TimeEntryRowProps {
  entry: TimeEntryWithProject;
  onPress?: () => void;
}

/** One time entry: project + description on the left, duration + status right. */
export function TimeEntryRow({ entry, onPress }: TimeEntryRowProps) {
  const t = useT();
  const { colors } = useTheme();
  const projectName = entry.project?.name ?? t('comp.project.fallbackName');
  const statusLabel = t('status.' + entry.status);

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
        {entry.tags && entry.tags.length > 0 ? (
          <View style={styles.tags}>
            {entry.tags.slice(0, 4).map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.fill }]}>
                <Txt variant="micro" tone="textMuted">
                  {tag}
                </Txt>
              </View>
            ))}
          </View>
        ) : null}
        {entry.status === 'rejected' && entry.rejection_reason ? (
          <Txt variant="caption" tone="danger" numberOfLines={2}>
            {t('details.rejectionReason')}: {entry.rejection_reason}
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
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 },
  tag: { paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: radii.sm },
});
