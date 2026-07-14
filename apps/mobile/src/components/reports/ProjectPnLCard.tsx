import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Money, Row, Txt, spacing, useTheme } from '@chrono/ui';
import { availableFunding, projectMargin, sumReferralEarnings } from '@chrono/sdk';
import type { Invoice, Project, ReferralEarning, RevenueEntry } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
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
}

/**
 * Presentational per-project profit & loss: revenue − referrals − freelancer
 * cost, + funding. Data is fetched once at the screen and sliced per project —
 * this component holds no hooks so it never fans out into an N+1.
 */
export function ProjectPnLCard({
  project,
  currency,
  revenueEntries,
  referralEarnings,
  invoices,
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

  const margin = projectMargin(revenueCents, referralCents, costCents);
  const funding = availableFunding(revenueEntries, referralEarnings, paidInvoices);

  return (
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading" numberOfLines={1}>
        {project.name}
      </Txt>
      <StatRow>
        <StatTile label={t('compb.pnl.revenue')}>
          <Money cents={revenueCents} currency={currency} variant="heading" />
        </StatTile>
        <StatTile label={t('compb.pnl.referrals')}>
          <Money cents={referralCents} currency={currency} variant="heading" tone="textMuted" />
        </StatTile>
        <StatTile label={t('compb.pnl.cost')}>
          <Money cents={costCents} currency={currency} variant="heading" tone="textMuted" />
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
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  divider: { height: 1, marginTop: spacing.xs },
});
