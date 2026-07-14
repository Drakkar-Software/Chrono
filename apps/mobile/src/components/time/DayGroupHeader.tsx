import { StyleSheet, View } from 'react-native';
import { Txt, spacing } from '@chrono/ui';
import { formatDuration } from '@chrono/sdk';

export interface DayGroupHeaderProps {
  /** Pre-formatted day label (e.g. "Mon 14 Jul"). */
  date: string;
  /** Total minutes logged that day — rendered as a mono duration on the right. */
  minutes: number;
}

/**
 * The "uppercase date ↔ mono day total" header that precedes a day's time
 * entries. Shared by the Today, Home and History screens.
 */
export function DayGroupHeader({ date, minutes }: DayGroupHeaderProps) {
  return (
    <View style={styles.header}>
      <Txt variant="label" tone="textMuted" uppercase>
        {date}
      </Txt>
      <Txt variant="label" tone="textMuted" mono>
        {formatDuration(minutes)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});
