import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Money, Row, TitledCard, spacing, useTheme } from '@chrono/ui';
import {
  availableFunding,
  costCumulative,
  dueRevenue,
  netAvailableFunding,
  projectMargin,
  sumApprovedExpenses,
  sumReferralEarnings,
  totalOutstanding,
} from '@chrono/sdk';
import type { Invoice, Project, ProjectCost, ReferralEarning, RevenueEntry } from '@chrono/sdk';

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
  /**
   * This project's costs of every kind, pre-filtered by the reports screen.
   * The pool kinds (recurring / one_off) and reimbursables are separated here,
   * since only the former reach the funding pool.
   */
  costs?: ProjectCost[];
  /**
   * Approved billable time not yet attached to an invoice, valued at each
   * freelancer's effective day rate (see `valueUninvoicedTime`). Cents.
   */
  uninvoicedTimeCents?: number;
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
  costs = [],
  uninvoicedTimeCents = 0,
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
  // Cumulative PAID pool cost through the current month, matching
  // settle_project_month's pool math (an unpaid cost hasn't left the pool yet).
  const fixedCostCents = useMemo(() => costCumulative(costs, todayISO()), [costs]);
  // Reimbursables are a real cost but, unlike pool costs, are paid outside the
  // FIFO pool — they affect margin only, not availableFunding.
  const expenseCents = useMemo(() => sumApprovedExpenses(costs), [costs]);

  const margin = projectMargin(revenueCents, referralCents, costCents, fixedCostCents, expenseCents);
  const funding = availableFunding(revenueEntries, referralEarnings, paidInvoices, fixedCostCents);
  // Recognized revenue the client hasn't paid yet — it doesn't count toward
  // `funding` until a manager marks it paid (see revenue-entry.lib#dueRevenue).
  const dueCents = useMemo(() => dueRevenue(revenueEntries), [revenueEntries]);
  // What's still owed to freelancers but hasn't left the pool: issued-but-unpaid
  // invoice balances plus approved time not yet invoiced. `totalOutstanding` and
  // `uninvoicedTimeCents` cover disjoint sets (on-an-invoice vs invoice_id IS
  // NULL), so summing them never double-counts.
  const owedCents = useMemo(
    () => totalOutstanding(invoices) + uninvoicedTimeCents,
    [invoices, uninvoicedTimeCents],
  );
  const netFunding = netAvailableFunding(funding, owedCents);

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
      {owedCents > 0 ? (
        <Row label={t('compb.pnl.owedToFreelancers')}>
          <Money cents={-owedCents} currency={currency} tone="warning" />
        </Row>
      ) : null}
      <Row label={t('compb.pnl.netAvailableFunding')}>
        <Money cents={netFunding} currency={currency} variant="heading" tone={netFunding >= 0 ? 'success' : 'danger'} />
      </Row>
      {dueCents > 0 ? (
        <Row label={t('compb.pnl.dueByClient')}>
          <Money cents={dueCents} currency={currency} tone="warning" />
        </Row>
      ) : null}
      <BudgetMeter project={project} usedCents={costCents} currency={currency} />
    </TitledCard>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, marginTop: spacing.xs },
});
