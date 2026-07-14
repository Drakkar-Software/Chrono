import { StyleSheet, View } from 'react-native';
import { Card, EmptyState, Money, Txt, spacing, useResponsive } from '@chrono/ui';
import { displayName, formatDuration } from '@chrono/sdk';
import type { CompanyMemberWithProfile } from '@chrono/sdk';
import type { FreelancerSummary } from '@/lib/reports';

export interface FreelancerBreakdownProps {
  rows: FreelancerSummary[];
  members: CompanyMemberWithProfile[];
  currency: string;
}

/** Per-freelancer days/hours worked and invoiced earned/paid, as a table. */
export function FreelancerBreakdown({ rows, members, currency }: FreelancerBreakdownProps) {
  const { isWide } = useResponsive();

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title="No activity"
        subtitle="No approved billable time or invoices in this range."
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
              {row.days.toFixed(2)} days · {formatDuration(row.minutes)}
            </Txt>
          </View>
          <View style={styles.amounts}>
            <View style={styles.amount}>
              <Txt variant="micro" mono uppercase tone="textMuted">
                Earned
              </Txt>
              <Money cents={row.earnedCents} currency={currency} variant="bodyMedium" />
            </View>
            <View style={styles.amount}>
              <Txt variant="micro" mono uppercase tone="textMuted">
                Paid
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
