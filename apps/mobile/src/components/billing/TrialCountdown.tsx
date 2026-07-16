import { Animated, StyleSheet, View } from 'react-native';
import { Txt, borders, radii, spacing, useTheme } from '@chrono/ui';
import { useT } from '@/lib/i18n';
import { useSettleProgress } from './useSettleProgress';

const TRIAL_LENGTH_DAYS = 30;

export interface TrialCountdownProps {
  daysLeft: number;
  /** Formatted local end date, e.g. "15 Aug". */
  endsOnLabel: string;
}

/** Same instrument language as {@link SeatCapacityTrack}: a big mono numeral over a draining ledger bar. */
export function TrialCountdown({ daysLeft, endsOnLabel }: TrialCountdownProps) {
  const { colors } = useTheme();
  const t = useT();
  const fraction = Math.max(0, Math.min(1, daysLeft / TRIAL_LENGTH_DAYS));
  const progress = useSettleProgress(fraction);

  return (
    <View style={styles.wrap}>
      <View style={styles.headline}>
        <Txt variant="displayLg" mono tabularNums weight="bold" tone="accent">
          {daysLeft}
        </Txt>
        <Txt variant="body" tone="textMuted">
          {t('tabs.billing.daysLeft')} · {t('tabs.billing.endsOn', { date: endsOnLabel })}
        </Txt>
      </View>
      <View style={[styles.track, { backgroundColor: colors.fill, borderColor: colors.border }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: colors.accent,
              width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm },
  headline: { alignItems: 'center', gap: spacing.xs / 2 },
  track: {
    width: '100%',
    height: 4,
    borderRadius: radii.pill,
    borderWidth: borders.hairline,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radii.pill },
});
