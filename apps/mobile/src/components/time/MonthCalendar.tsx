import { StyleSheet, View } from 'react-native';
import { Txt, borders, radii, spacing, useTheme } from '@chrono/ui';
import { isoWeekday } from '@chrono/sdk';
import { useT } from '@/lib/i18n';
import { buildMonthGrid } from './month-calendar.lib';

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
            const logged = minutes > 0;
            const bg = !day.inMonth
              ? 'transparent'
              : logged
                ? colors.accentBg
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
                  <Txt
                    variant="caption"
                    tone={!day.inMonth ? 'textFaint' : logged ? 'accent' : 'textMuted'}
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
  },
});
