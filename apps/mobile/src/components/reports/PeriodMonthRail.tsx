import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt, borders, elevation, radii, spacing, useTheme } from '@chrono/ui';

import { useLanguage, useT } from '@/lib/i18n';
import { selectableMonths, stampMonthLabel, type StatsPeriod } from '@/lib/period-month';

export interface PeriodMonthRailProps {
  value: StatsPeriod;
  onChange: (next: StatsPeriod) => void;
  /** How many past months to offer (default 24). */
  monthCount?: number;
  /** Eyebrow label key override (defaults to details.statsPeriod). */
  eyebrowKey?: string;
  /** When true, insert a "This week" stamp after All. */
  showThisWeek?: boolean;
}

/**
 * Ledger-style period stamp rail: ALL (+ optional this week) + scrollable months.
 * Brass plate marks the active period — precision instrument, not a chip cloud.
 */
export function PeriodMonthRail({
  value,
  onChange,
  monthCount = 24,
  eyebrowKey = 'details.statsPeriod',
  showThisWeek = false,
}: PeriodMonthRailProps) {
  const t = useT();
  const { locale } = useLanguage();
  const { colors } = useTheme();
  const months = selectableMonths(monthCount);

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Txt variant="micro" mono uppercase tone="textMuted" style={styles.eyebrow}>
          {t(eyebrowKey)}
        </Txt>
        <View style={[styles.rule, { backgroundColor: colors.ledgerRule }]} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        <Stamp
          label={t('details.statsAll')}
          active={value === 'all'}
          onPress={() => onChange('all')}
          wide
        />
        {showThisWeek ? (
          <>
            <View style={[styles.sep, { backgroundColor: colors.borderStrong }]} />
            <Stamp
              label={t('compb.history.thisWeek')}
              active={value === 'thisWeek'}
              onPress={() => onChange('thisWeek')}
            />
          </>
        ) : null}
        <View style={[styles.sep, { backgroundColor: colors.borderStrong }]} />
        {months.map((m) => (
          <Stamp
            key={m}
            label={stampMonthLabel(m, locale)}
            active={value === m}
            onPress={() => onChange(m)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Stamp({
  label,
  active,
  onPress,
  wide = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  wide?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.stamp,
        wide && styles.stampWide,
        {
          backgroundColor: active ? colors.accentBgStrong : colors.fill,
          borderColor: active ? colors.accent : colors.border,
        },
        active && elevation('sm'),
        pressed && { opacity: 0.85 },
      ]}
    >
      <Txt
        variant="micro"
        mono
        uppercase
        weight={active ? 'bold' : 'semibold'}
        tone={active ? 'accent' : 'textMuted'}
        numberOfLines={1}
      >
        {label}
      </Txt>
      <View
        style={[
          styles.stampRule,
          { backgroundColor: active ? colors.accent : colors.ledgerRule },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyebrow: { letterSpacing: 1.4 },
  rule: { flex: 1, height: borders.hairline },
  rail: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  sep: {
    width: borders.hairline,
    alignSelf: 'stretch',
    marginHorizontal: spacing.xs,
    opacity: 0.7,
  },
  stamp: {
    minWidth: 72,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: borders.thin,
    gap: spacing.xs,
    alignItems: 'center',
  },
  stampWide: { minWidth: 56, paddingHorizontal: spacing.md },
  stampRule: { alignSelf: 'stretch', height: 2, borderRadius: 1 },
});
