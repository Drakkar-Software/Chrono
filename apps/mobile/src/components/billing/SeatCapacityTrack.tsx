import { Animated, StyleSheet, View } from 'react-native';
import { Txt, borders, radii, spacing, useTheme } from '@chrono/ui';
import { useT } from '@/lib/i18n';
import { useSettleProgress } from './useSettleProgress';

export interface SeatCapacityTrackProps {
  /** Seat marks in ascending order, e.g. [3, 10, 25]. */
  tiers: { seatLimit: number; label: string }[];
  /** The company's current member count — where the live indicator sits. */
  seatCount: number;
}

/**
 * Chrono Pro's signature element: a graduated ruler with the plan tiers at
 * their seat marks and a live indicator at the company's current member
 * count — the plan tiers ARE an honest capacity sequence (3 → 10 → 25 seats),
 * so a ruler is structure here, not decoration.
 */
export function SeatCapacityTrack({ tiers, seatCount }: SeatCapacityTrackProps) {
  const { colors } = useTheme();
  const t = useT();
  const max = tiers[tiers.length - 1]?.seatLimit ?? 1;
  const fraction = Math.min(1, seatCount / max);
  const progress = useSettleProgress(fraction);

  return (
    <View>
      <View style={styles.header}>
        <Txt variant="caption" tone="textMuted" uppercase>
          {t('tabs.billing.yourTeam')}
        </Txt>
        <Txt variant="bodyMedium" mono tabularNums tone="accent">
          {t('tabs.billing.seatCount', { n: seatCount })}
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
        {tiers.map((tier) => (
          <View
            key={tier.seatLimit}
            pointerEvents="none"
            style={[styles.tick, { left: `${(tier.seatLimit / max) * 100}%`, backgroundColor: colors.ledgerRule }]}
          />
        ))}
      </View>
      <View style={styles.marks}>
        {tiers.map((tier, i) => (
          <View
            key={tier.seatLimit}
            style={[
              styles.mark,
              i === tiers.length - 1 ? { right: 0 } : { left: `${(tier.seatLimit / max) * 100}%` },
            ]}
          >
            <Txt variant="micro" tone="textFaint" mono tabularNums>
              {tier.label} · {tier.seatLimit}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

const TRACK_HEIGHT = 8;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.xs },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radii.pill,
    borderWidth: borders.hairline,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: borders.thin,
  },
  marks: { position: 'relative', height: 16, marginTop: spacing.xs },
  mark: { position: 'absolute' },
});
