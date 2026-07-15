import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt, radii, spacing, useTheme } from '@chrono/ui';
import { formatDuration, shiftEntryDate } from '@chrono/sdk';
import type { TimeEntryWithProject } from '@chrono/sdk';
import { useT } from '@/lib/i18n';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export interface WeekStripProps {
  entries: TimeEntryWithProject[];
  /** Monday of the week (YYYY-MM-DD). */
  weekStart: string;
}

/**
 * A compact, glanceable "this week" strip: one column per day with its total
 * duration, no project breakdown. Replaces the old project × weekday matrix —
 * the day-grouped entry list below already shows per-entry project detail, so
 * this stays a single at-a-glance row instead of a second competing table.
 */
export function WeekStrip({ entries, weekStart }: WeekStripProps) {
  const t = useT();
  const { colors } = useTheme();

  const totals = useMemo(() => {
    const dayDates = Array.from({ length: 7 }, (_, i) => shiftEntryDate(weekStart, i));
    const minutes = Array(7).fill(0) as number[];
    for (const e of entries) {
      const idx = dayDates.indexOf(e.entry_date.slice(0, 10));
      if (idx >= 0) minutes[idx] += e.duration_minutes ?? 0;
    }
    return dayDates.map((date, i) => ({ date, minutes: minutes[i] }));
  }, [entries, weekStart]);

  return (
    <View style={styles.row}>
      {totals.map((d, i) => {
        const logged = d.minutes > 0;
        return (
          <View key={d.date} style={styles.col}>
            <Txt variant="micro" tone="textFaint" uppercase>
              {t('comp.time.weekday.' + DAY_KEYS[i])}
            </Txt>
            <View
              style={[
                styles.bar,
                { backgroundColor: logged ? colors.accentBg : colors.fill, borderColor: logged ? colors.accentBorder : colors.border },
              ]}
            >
              <Txt variant="micro" tone={logged ? 'accent' : 'textFaint'} mono tabularNums numberOfLines={1}>
                {logged ? formatDuration(d.minutes) : '·'}
              </Txt>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  col: { flex: 1, alignItems: 'center', gap: spacing.xs },
  bar: {
    width: '100%',
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
  },
});
