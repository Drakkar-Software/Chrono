import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Money, Row, Txt, spacing, useTheme } from '@chrono/ui';
import { availableFunding, projectMargin, sumReferralEarnings } from '@chrono/sdk';
import type { Project } from '@chrono/sdk';

import { useRevenueEntries } from '@/lib/hooks/use-revenue-entries';
import { useReferralEarnings } from '@/lib/hooks/use-referral-earnings';
import { useInvoices } from '@/lib/hooks/use-invoices';
import { StatRow, StatTile } from '@/components/ui/StatTile';

export interface ProjectPnLCardProps {
  project: Project;
  companyId: string;
  currency: string;
}

/** Per-project profit & loss: revenue − referrals − freelancer cost, + funding. */
export function ProjectPnLCard({ project, companyId, currency }: ProjectPnLCardProps) {
  const { colors } = useTheme();
  const { data: revenueEntries } = useRevenueEntries(project.id);
  const { data: referralEarnings } = useReferralEarnings({ projectId: project.id, companyId });
  const { data: invoices } = useInvoices({ companyId, projectId: project.id });

  const revenueCents = useMemo(
    () => (revenueEntries ?? []).reduce((acc, r) => acc + (r.amount_cents ?? 0), 0),
    [revenueEntries],
  );
  const referralCents = useMemo(
    () => sumReferralEarnings(referralEarnings ?? []),
    [referralEarnings],
  );
  const costCents = useMemo(
    () => (invoices ?? []).reduce((acc, i) => acc + (i.earned_cents ?? 0), 0),
    [invoices],
  );
  const paidInvoices = useMemo(
    () => (invoices ?? []).map((i) => ({ amount_paid_cents: i.amount_paid_cents ?? 0 })),
    [invoices],
  );

  const margin = projectMargin(revenueCents, referralCents, costCents);
  const funding = availableFunding(revenueEntries ?? [], referralEarnings ?? [], paidInvoices);

  return (
    <Card padding="lg" style={styles.card}>
      <Txt variant="heading" numberOfLines={1}>
        {project.name}
      </Txt>
      <StatRow>
        <StatTile label="Revenue">
          <Money cents={revenueCents} currency={currency} variant="heading" />
        </StatTile>
        <StatTile label="Referrals">
          <Money cents={referralCents} currency={currency} variant="heading" tone="textMuted" />
        </StatTile>
        <StatTile label="Cost">
          <Money cents={costCents} currency={currency} variant="heading" tone="textMuted" />
        </StatTile>
        <StatTile label="Margin">
          <Money cents={margin} currency={currency} variant="heading" tone={margin >= 0 ? 'success' : 'danger'} />
        </StatTile>
      </StatRow>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Row label="Available funding">
        <Money cents={funding} currency={currency} tone="textMuted" />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  divider: { height: 1, marginTop: spacing.xs },
});
