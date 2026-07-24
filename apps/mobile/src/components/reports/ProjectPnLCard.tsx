import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Money, Row, TitledCard, spacing, useTheme } from '@chrono/ui';
import {
  availableFunding,
  companyFeeCents,
  costCumulative,
  dueRevenue,
  netAvailableFunding,
  projectMargin,
  sumApprovedExpenses,
  sumReferralEarnings,
  totalCostForMonth,
  totalOutstanding,
} from '@chrono/sdk';
import type { Invoice, Project, ProjectCost, ReferralEarning, RemPolicy, RevenueEntry } from '@chrono/sdk';

import { useLanguage, useT } from '@/lib/i18n';
import { todayISO } from '@/lib/date';
import { longMonthLabel, matchesPeriodMonth, type StatsPeriod } from '@/lib/period-month';
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
  /**
   * Stats window: `'all'` (default, lifetime) or a calendar month `'YYYY-MM'`.
   * Filters revenue / referrals / invoices / expenses; fixed costs use that
   * month's amount instead of the cumulative pool through today.
   */
  period?: StatsPeriod;
  /** Company fee % — used for product-service license carve-out. */
  companyFeePct?: number;
  /** Default license % — shown when rem policy is product_service. */
  licensePct?: number;
}

/** License carve-out applies to product-service projects only. */
function showsLicense(policy: RemPolicy | null | undefined): boolean {
  return policy === 'product_service';
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
  period = 'all',
  companyFeePct = 0,
  licensePct = 0,
}: ProjectPnLCardProps) {
  const t = useT();
  const { locale } = useLanguage();
  const { colors } = useTheme();
  const month = period === 'all' ? null : period;

  const scopedRevenue = useMemo(
    () => (month ? revenueEntries.filter((r) => matchesPeriodMonth(r.period_month, month)) : revenueEntries),
    [revenueEntries, month],
  );
  const scopedReferrals = useMemo(
    () => (month ? referralEarnings.filter((r) => matchesPeriodMonth(r.period_month, month)) : referralEarnings),
    [referralEarnings, month],
  );
  const scopedInvoices = useMemo(
    () => (month ? invoices.filter((i) => matchesPeriodMonth(i.period_month, month)) : invoices),
    [invoices, month],
  );

  const revenueCents = useMemo(
    () => scopedRevenue.reduce((acc, r) => acc + (r.amount_cents ?? 0), 0),
    [scopedRevenue],
  );
  const referralCents = useMemo(() => sumReferralEarnings(scopedReferrals), [scopedReferrals]);
  // Cost = earned on real (submitted/settled) invoices only; drafts aren't
  // committed cost and cancelled invoices don't count.
  const costCents = useMemo(
    () =>
      scopedInvoices
        .filter((i) => i.status === 'submitted' || i.status === 'partially_paid' || i.status === 'paid')
        .reduce((acc, i) => acc + (i.earned_cents ?? 0), 0),
    [scopedInvoices],
  );
  const paidInvoices = useMemo(
    () => scopedInvoices.map((i) => ({ amount_paid_cents: i.amount_paid_cents ?? 0 })),
    [scopedInvoices],
  );
  // Lifetime: cumulative PAID pool cost through today (settle parity).
  // Month: that month's deductible pool amount only.
  const fixedCostCents = useMemo(
    () => (month ? totalCostForMonth(costs, month) : costCumulative(costs, todayISO())),
    [costs, month],
  );
  // Reimbursables are a real cost but, unlike pool costs, are paid outside the
  // FIFO pool — they affect margin only, not availableFunding.
  const expenseCents = useMemo(() => {
    if (!month) return sumApprovedExpenses(costs);
    return costs
      .filter(
        (c) =>
          c.kind === 'reimbursable' &&
          c.status === 'approved' &&
          c.spent_on != null &&
          matchesPeriodMonth(c.spent_on, month),
      )
      .reduce((acc, c) => acc + (c.amount_cents ?? 0), 0);
  }, [costs, month]);

  // Product-service license = (paid R − company fee) × license% — same carve-out as rem.
  const licenseCents = useMemo(() => {
    if (!showsLicense(project.rem_policy) || licensePct <= 0) return 0;
    const paidRevenue = scopedRevenue
      .filter((r) => r.paid_at != null)
      .reduce((acc, r) => acc + (r.amount_cents ?? 0), 0);
    if (paidRevenue <= 0) return 0;
    const fee = companyFeeCents(paidRevenue, companyFeePct);
    return Math.round(((paidRevenue - fee) * licensePct) / 100);
  }, [project.rem_policy, licensePct, companyFeePct, scopedRevenue]);

  const margin = projectMargin(revenueCents, referralCents, costCents, fixedCostCents, expenseCents);
  const periodCostCents = fixedCostCents + costCents + expenseCents;
  // Funding / owed / net are cumulative pool figures — only meaningful for All.
  const showFunding = month == null;
  const funding = showFunding
    ? availableFunding(scopedRevenue, scopedReferrals, paidInvoices, fixedCostCents)
    : 0;
  const dueCents = useMemo(() => dueRevenue(scopedRevenue), [scopedRevenue]);
  const owedCents = useMemo(
    () => (showFunding ? totalOutstanding(scopedInvoices) + uninvoicedTimeCents : 0),
    [showFunding, scopedInvoices, uninvoicedTimeCents],
  );
  const netFunding = showFunding ? netAvailableFunding(funding, owedCents) : 0;

  const title =
    month != null
      ? `${project.name} · ${longMonthLabel(month, locale)}`
      : project.name;

  return (
    <TitledCard title={title} titleNumberOfLines={1}>
      <StatRow>
        <StatTile label={t('compb.pnl.revenue')}>
          <Money cents={revenueCents} currency={currency} variant="heading" />
        </StatTile>
        <StatTile label={t('compb.pnl.referrals')}>
          <Money cents={referralCents} currency={currency} variant="heading" tone="textMuted" />
        </StatTile>
        <StatTile label={t('compb.pnl.periodCosts')}>
          <Money cents={periodCostCents} currency={currency} variant="heading" tone="textMuted" />
        </StatTile>
        {showsLicense(project.rem_policy) ? (
          <StatTile label={t('compb.pnl.license')}>
            <Money cents={licenseCents} currency={currency} variant="heading" tone="textMuted" />
          </StatTile>
        ) : null}
        <StatTile label={t('compb.pnl.margin')}>
          <Money cents={margin} currency={currency} variant="heading" tone={margin >= 0 ? 'success' : 'danger'} />
        </StatTile>
      </StatRow>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      {showFunding ? (
        <>
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
        </>
      ) : null}
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
