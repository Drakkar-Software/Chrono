import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Txt, borders, radii, spacing, useTheme } from '@chrono/ui';
import { formatDuration, shiftEntryDate } from '@chrono/sdk';
import type { TimeEntryWithProject } from '@chrono/sdk';
import { useT } from '@/lib/i18n';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export interface WeekGridProps {
  entries: TimeEntryWithProject[];
  /** Monday of the week (YYYY-MM-DD). */
  weekStart: string;
}

/**
 * A project × weekday grid of logged minutes for one week. The day columns live
 * in a horizontal ScrollView so the grid never overflows a narrow screen.
 */
export function WeekGrid({ entries, weekStart }: WeekGridProps) {
  const t = useT();
  const { colors } = useTheme();

  const { rows, dayDates } = useMemo(() => {
    const dayDates = Array.from({ length: 7 }, (_, i) => shiftEntryDate(weekStart, i));
    const dayIndex = new Map(dayDates.map((d, i) => [d, i]));
    // project_id -> { name, minutes[7] }
    const byProject = new Map<string, { name: string; minutes: number[] }>();
    for (const e of entries) {
      const idx = dayIndex.get(e.entry_date.slice(0, 10));
      if (idx == null) continue;
      const row = byProject.get(e.project_id) ?? {
        name: e.project?.name ?? t('comp.project.fallbackName'),
        minutes: Array(7).fill(0) as number[],
      };
      row.minutes[idx] += e.duration_minutes ?? 0;
      byProject.set(e.project_id, row);
    }
    return { rows: [...byProject.values()], dayDates };
  }, [entries, weekStart, t]);

  if (rows.length === 0) return null;

  const colTotals = dayDates.map((_, i) => rows.reduce((acc, r) => acc + r.minutes[i], 0));

  return (
    <Card padding="md" style={styles.card}>
      <Txt variant="label" tone="textMuted" uppercase>
        {t('comp.time.weekOverview')}
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header */}
          <View style={styles.row}>
            <View style={styles.projectCell} />
            {DAY_KEYS.map((d) => (
              <View key={d} style={styles.dayCell}>
                <Txt variant="micro" tone="textFaint">
                  {t('comp.time.weekday.' + d)}
                </Txt>
              </View>
            ))}
          </View>
          {/* Project rows */}
          {rows.map((r) => (
            <View key={r.name} style={[styles.row, { borderTopColor: colors.border }]}>
              <View style={styles.projectCell}>
                <Txt variant="caption" numberOfLines={1}>
                  {r.name}
                </Txt>
              </View>
              {r.minutes.map((m, i) => (
                <View key={i} style={[styles.dayCell, m > 0 && { backgroundColor: colors.accentBg }]}>
                  <Txt variant="micro" tone={m > 0 ? 'text' : 'textFaint'} tabularNums>
                    {m > 0 ? formatDuration(m) : '·'}
                  </Txt>
                </View>
              ))}
            </View>
          ))}
          {/* Totals */}
          <View style={[styles.row, styles.totalRow, { borderTopColor: colors.borderStrong }]}>
            <View style={styles.projectCell}>
              <Txt variant="micro" tone="textMuted" uppercase>
                {t('common.total')}
              </Txt>
            </View>
            {colTotals.map((m, i) => (
              <View key={i} style={styles.dayCell}>
                <Txt variant="micro" tone="textMuted" tabularNums>
                  {m > 0 ? formatDuration(m) : '·'}
                </Txt>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', borderTopWidth: borders.hairline },
  totalRow: { borderTopWidth: borders.thin },
  projectCell: { width: 96, paddingVertical: spacing.xs, paddingRight: spacing.xs },
  dayCell: {
    width: 44,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
});
