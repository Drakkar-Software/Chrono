import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge, Txt, spacing, useTheme } from '@chrono/ui';
import { displayName } from '@chrono/sdk';
import type { CompanyMemberWithProfile } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import type { UtilizationRow } from '@/lib/reports';
import { TrendChart, type TrendPoint } from '@/components/reports/TrendChart';

export interface CapacityCardProps {
  rows: UtilizationRow[];
  members: CompanyMemberWithProfile[];
}

/** Per-member utilization (worked / capacity days) for the selected range, with over-capacity flags. */
export function CapacityCard({ rows, members }: CapacityCardProps) {
  const t = useT();
  const { colors } = useTheme();
  const byUser = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  // Center bars at 100% capacity (TrendChart's zero baseline) so over-capacity
  // renders above the line in `color` and under-capacity below it in `negativeColor`.
  const points: TrendPoint[] = rows
    .filter((r) => r.capacityDays > 0)
    .map((r) => ({
      label: displayName(byUser.get(r.userId)?.profile) || t('compb.approval.project'),
      value: Math.round(r.utilizationPct) - 100,
    }));

  const overCount = rows.filter((r) => r.status === 'over').length;

  if (points.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {overCount > 0 ? (
        <Badge label={t('compb.capacity.overCount', { n: overCount })} status="danger" />
      ) : null}
      <TrendChart
        points={points}
        color={colors.danger}
        negativeColor={colors.accent}
        formatValue={(v) => `${v + 100}%`}
      />
      <Txt variant="caption" tone="textMuted">
        {t('compb.capacity.caption')}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
});
