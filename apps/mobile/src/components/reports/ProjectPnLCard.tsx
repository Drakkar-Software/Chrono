import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Money, Row, TitledCard, spacing, useTheme } from '@chrono/ui';
import { availableFunding, fixedCostCumulative, projectMargin, sumApprovedExpenses, sumReferralEarnings } from '@chrono/sdk';
import type { Invoice, Project, ProjectExpense, ProjectFixedCost, ReferralEarning, RevenueEntry } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { todayISO } from '@/lib/date';
import { StatRow, StatTile } from '@/components/ui/StatTile';
import { BudgetMeter } from '@/components/reports/BudgetMeter';

export interface ProjectPnLCardProps {
  project: Project;
  currency: string;
  /** This project's revenue entries (pre-filtered by the reports screen). */
  revenueEntries: RevenueEntry[];
  /** This project's referral earnings (pre-filtered by the reports screen). */
  referralEarnings: ReferralEarning[];
  /** This project's invoices (pre-filtered by the reports screen). */
  invoices: Invoice[];
  /** This project's fixed cost definitions (hosting, tooling, etc.), pre-filtered by the reports screen. */
  fixedCosts?: ProjectFixedCost[];
  /** This project's expenses, pre-filtered by the reports screen. */
  expenses?: ProjectExpense[];
}

/**
 * Presentational per-project profit & loss: revenue − referrals − fixed costs
 * − freelancer cost, + funding. Data is fetched once at the screen and sliced
 * per project — this component holds no hooks so it never fans out into an N+1.
 */
export function ProjectPnLCard({
  project,
  currency,
  revenueEntries,
  referralEarnings,
  invoices,
  fixedCosts = [],
  expenses = [],
}: ProjectPnLCardProps) {
  const t = useT();
  const { colors } = useTheme();

  const revenueCents = useMemo(
    () => revenueEntries.reduce((acc, r) => acc + (r.amount_cents ?? 0), 0),
    [revenueEntries],
  );
  const referralCents = useMemo(
    () => sumReferralEarnings(referralEarnings),
    [referralEarnings],
  );
  // Cost = earned on real (submitted/settled) invoices only; drafts aren't
  // committed cost and cancelled invoices don't count.
  const costCents = useMemo(
    () =>
      invoices
        .filter((i) => i.status === 'submitted' || i.status === 'partially_paid' || i.status === 'paid')
        .reduce((acc, i) => acc + (i.earned_cents ?? 0), 0),
    [invoices],
  );
  const paidInvoices = useMemo(
    () => invoices.map((i) => ({ amount_paid_cents: i.amount_paid_cents ?? 0 })),
    [invoices],
  );
  // Cumulative through the current month, matching settle_project_month's pool math.
  const fixedCostCents = useMemo(
    () => fixedCostCumulative(fixedCosts, todayISO()),
    [fixedCosts],
  );
  // Reimbursable expenses are a real cost but, unlike fixed costs, are paid
  // outside the FIFO pool — they affect margin only, not availableFunding.
  const expenseCents = useMemo(() => sumApprovedExpenses(expenses), [expenses]);

  const margin = projectMargin(revenueCents, referralCents, costCents, fixedCostCents, expenseCents);
  const funding = availableFunding(revenueEntries, referralEarnings, paidInvoices, fixedCostCents);

  return (
    <TitledCard title={project.name} titleNumberOfLines={1}>
      <StatRow>
        <StatTile label={t('compb.pnl.revenue')}>
          <Money cents={revenueCents} currency={currency} variant="heading" />
        </StatTile>
        <StatTile label={t('compb.pnl.referrals')}>
          <Money cents={referralCents} currency={currency} variant="heading" tone="textMuted" />
        </StatTile>
        <StatTile label={t('compb.pnl.fixedCosts')}>
          <Money cents={fixedCostCents} currency={currency} variant="heading" tone="textMuted" />
        </StatTile>
        <StatTile label={t('compb.pnl.cost')}>
          <Money cents={costCents} currency={currency} variant="heading" tone="textMuted" />
        </StatTile>
        <StatTile label={t('compb.pnl.expenses')}>
          <Money cents={expenseCents} currency={currency} variant="heading" tone="textMuted" />
        </StatTile>
        <StatTile label={t('compb.pnl.margin')}>
          <Money cents={margin} currency={currency} variant="heading" tone={margin >= 0 ? 'success' : 'danger'} />
        </StatTile>
      </StatRow>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Row label={t('compb.pnl.availableFunding')}>
        <Money cents={funding} currency={currency} tone="textMuted" />
      </Row>
      <BudgetMeter project={project} usedCents={costCents} currency={currency} />
    </TitledCard>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, marginTop: spacing.xs },
});
