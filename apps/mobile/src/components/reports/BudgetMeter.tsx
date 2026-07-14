import { StyleSheet, View } from 'react-native';
import { Badge, Txt, formatMoney, radii, spacing, useTheme } from '@chrono/ui';
import { budgetUsage } from '@chrono/sdk';
import type { Project } from '@chrono/sdk';

import { useT } from '@/lib/i18n';

export interface BudgetMeterProps {
  project: Pick<Project, 'budget_cents'>;
  /** Amount committed against the budget (e.g. invoiced freelancer cost). */
  usedCents: number;
  currency: string;
}

/** A budget progress bar with an over/near-budget badge. Hidden when no cap. */
export function BudgetMeter({ project, usedCents, currency }: BudgetMeterProps) {
  const t = useT();
  const { colors } = useTheme();
  const usage = budgetUsage(project, usedCents);
  if (usage.status === 'none' || usage.budgetCents == null) return null;

  const toneColor =
    usage.status === 'over' ? colors.danger : usage.status === 'warning' ? colors.warning : colors.accent;
  const pct = Math.min(1, usage.ratio);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Txt variant="micro" mono uppercase tone="textMuted">
          {t('compb.budget.budget')}
        </Txt>
        {usage.status === 'over' ? (
          <Badge label={t('compb.budget.overBudget')} status="danger" />
        ) : usage.status === 'warning' ? (
          <Badge label={t('compb.budget.nearBudget')} status="warning" />
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: colors.fill }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: toneColor }]} />
      </View>
      <View style={styles.labelRow}>
        <Txt variant="caption" tone="textMuted">
          {t('compb.budget.usedOf', {
            used: formatMoney(usedCents, currency),
            total: formatMoney(usage.budgetCents, currency),
          })}
        </Txt>
        <Txt variant="caption" tone="textMuted">
          {`${Math.round(usage.ratio * 100)}%`}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: radii.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radii.pill },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
