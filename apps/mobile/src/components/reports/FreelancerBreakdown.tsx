import { StyleSheet, View } from 'react-native';
import { Card, EmptyState, Money, Txt, spacing, useResponsive } from '@chrono/ui';
import { displayName, formatDuration } from '@chrono/sdk';
import type { CompanyMemberWithProfile } from '@chrono/sdk';
import { useT } from '@/lib/i18n';
import type { FreelancerSummary } from '@/lib/reports';

export interface FreelancerBreakdownProps {
  rows: FreelancerSummary[];
  members: CompanyMemberWithProfile[];
  currency: string;
}

/** Per-freelancer days/hours worked and invoiced earned/paid, as a table. */
export function FreelancerBreakdown({ rows, members, currency }: FreelancerBreakdownProps) {
  const t = useT();
  const { isWide } = useResponsive();

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title={t('compb.reports.noActivity')}
        subtitle={t('compb.reports.noActivitySubtitle')}
      />
    );
  }

  const nameFor = (userId: string): string => {
    const member = members.find((m) => m.user_id === userId);
    return displayName(member?.profile);
  };

  return (
    <Card padding="md" style={styles.card}>
      {rows.map((row) => (
        <View key={row.userId} style={[styles.row, isWide && styles.rowWide]}>
          <View style={styles.who}>
            <Txt variant="bodyMedium" numberOfLines={1}>
              {nameFor(row.userId)}
            </Txt>
            <Txt variant="caption" tone="textMuted" numberOfLines={1}>
              {t('compb.reports.daysAndDuration', {
                days: row.days.toFixed(2),
                duration: formatDuration(row.minutes),
              })}
            </Txt>
          </View>
          <View style={styles.amounts}>
            <View style={styles.amount}>
              <Txt variant="micro" mono uppercase tone="textMuted">
                {t('compb.reports.earned')}
              </Txt>
              <Money cents={row.earnedCents} currency={currency} variant="bodyMedium" />
            </View>
            <View style={styles.amount}>
              <Txt variant="micro" mono uppercase tone="textMuted">
                {t('compb.reports.paid')}
              </Txt>
              <Money cents={row.paidCents} currency={currency} variant="bodyMedium" tone="success" />
            </View>
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { gap: spacing.sm },
  rowWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  who: { flex: 1, gap: 2 },
  amounts: { flexDirection: 'row', gap: spacing.lg },
  amount: { gap: 2, minWidth: 88 },
});
