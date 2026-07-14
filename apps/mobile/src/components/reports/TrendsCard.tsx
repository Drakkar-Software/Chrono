import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Segmented, Txt, spacing, useTheme } from '@chrono/ui';

import type { MonthlyPoint } from '@/lib/reports';
import { TrendChart } from '@/components/reports/TrendChart';

type Metric = 'revenue' | 'cost' | 'margin';

const METRIC_OPTIONS = [
  { label: 'Revenue', value: 'revenue' },
  { label: 'Cost', value: 'cost' },
  { label: 'Margin', value: 'margin' },
];

/** Compact currency for axis captions ("€1.2K"). */
function compactMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

export interface TrendsCardProps {
  points: MonthlyPoint[];
  currency: string;
}

/** Monthly revenue / cost / margin trend with a metric switcher. */
export function TrendsCard({ points, currency }: TrendsCardProps) {
  const { colors } = useTheme();
  const [metric, setMetric] = useState<Metric>('revenue');

  const chartPoints = useMemo(
    () =>
      points.map((p) => ({
        label: p.month,
        value:
          metric === 'revenue' ? p.revenueCents : metric === 'cost' ? p.costCents : p.marginCents,
      })),
    [points, metric],
  );

  const hasData = points.some((p) => p.revenueCents || p.costCents || p.marginCents);
  const color = metric === 'cost' ? colors.textMuted : colors.accent;

  return (
    <Card padding="lg" style={styles.card}>
      <Segmented options={METRIC_OPTIONS} value={metric} onValueChange={(v) => setMetric(v as Metric)} />
      {hasData ? (
        <TrendChart
          points={chartPoints}
          color={color}
          negativeColor={colors.danger}
          formatValue={(v) => compactMoney(v, currency)}
        />
      ) : (
        <Txt variant="caption" tone="textMuted" style={styles.empty}>
          No activity in the last few months yet.
        </Txt>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  empty: { paddingVertical: spacing.lg, textAlign: 'center' },
});
