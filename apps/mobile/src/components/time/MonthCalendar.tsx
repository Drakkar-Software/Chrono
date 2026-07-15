import { StyleSheet, View } from 'react-native';
import { Txt, borders, radii, spacing, useTheme } from '@chrono/ui';
import { DEFAULT_HOURS_PER_DAY, isoWeekday } from '@chrono/sdk';
import { useT } from '@/lib/i18n';
import { buildMonthGrid, dayFillPct } from './month-calendar.lib';

const DAILY_TARGET_MINUTES = DEFAULT_HOURS_PER_DAY * 60;
// Above this fill level the liquid covers the digit's own row, so the day
// number needs to switch to the on-accent color to stay readable.
const READABLE_ON_FILL_THRESHOLD = 0.5;

export interface MonthCalendarProps {
  /** Any date within the month to render, e.g. from `monthKey(todayISO())`. */
  monthISO: string;
  /** Minutes logged per day ('YYYY-MM-DD' -> minutes). */
  minutesByDay: Record<string, number>;
  workingWeekdays: number[];
  holidayDates: string[];
  /** Today's date, for the "current day" ring. */
  today: string;
}

const WEEKDAY_LABEL_KEYS = [
  'comp.weekday.monShort',
  'comp.weekday.tueShort',
  'comp.weekday.wedShort',
  'comp.weekday.thuShort',
  'comp.weekday.friShort',
  'comp.weekday.satShort',
  'comp.weekday.sunShort',
];

/**
 * A compact month grid marking days with logged time, dimming non-working
 * days and holidays, and ringing today — the "work calendar" glance view.
 */
export function MonthCalendar({ monthISO, minutesByDay, workingWeekdays, holidayDates, today }: MonthCalendarProps) {
  const t = useT();
  const { colors } = useTheme();
  const weeks = buildMonthGrid(monthISO);
  const holidaySet = new Set(holidayDates.map((h) => h.slice(0, 10)));
  const workSet = new Set(workingWeekdays);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {WEEKDAY_LABEL_KEYS.map((key) => (
          <View key={key} style={styles.cell}>
            <Txt variant="micro" tone="textFaint" uppercase>
              {t(key)}
            </Txt>
          </View>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0].date} style={styles.row}>
          {week.map((day) => {
            const dayNum = day.date.slice(8, 10);
            const isToday = day.date === today;
            const isHoliday = holidaySet.has(day.date);
            const isWorkingDay = workSet.has(isoWeekday(day.date));
            const minutes = minutesByDay[day.date] ?? 0;
            const pct = day.inMonth ? dayFillPct(minutes, DAILY_TARGET_MINUTES) : 0;
            const logged = pct > 0;
            const bg = !day.inMonth
              ? 'transparent'
              : isHoliday || !isWorkingDay
                ? colors.fill
                : colors.surface;
            return (
              <View key={day.date} style={styles.cell}>
                <View
                  style={[
                    styles.day,
                    {
                      backgroundColor: bg,
                      borderColor: isToday ? colors.accent : 'transparent',
                      borderWidth: isToday ? borders.thick : 0,
                    },
                  ]}
                >
                  {logged ? (
                    <View style={[styles.fill, { height: `${pct * 100}%`, backgroundColor: colors.accent }]} />
                  ) : null}
                  <Txt
                    variant="caption"
                    color={
                      !day.inMonth
                        ? colors.textFaint
                        : !logged
                          ? colors.textMuted
                          : pct >= READABLE_ON_FILL_THRESHOLD
                            ? colors.accentText
                            : colors.accent
                    }
                  >
                    {dayNum}
                  </Txt>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  day: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
