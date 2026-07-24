import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter, type Href } from 'expo-router';
import { Badge, Button, Card, ListItem, Money, StackScreen, Txt, spacing } from '@chrono/ui';
import {
  canManage,
  companyCurrency,
  costCumulative,
  projectMargin,
  sumApprovedExpenses,
  sumReferralEarnings,
} from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { todayISO } from '@/lib/date';
import { usePendingApprovals } from '@/lib/hooks/use-approvals';
import { usePendingExpenses, useCompanyProjectCosts } from '@/lib/hooks/use-project-costs';
import { useCompanyRevenueEntries } from '@/lib/hooks/use-revenue-entries';
import { useReferralEarnings } from '@/lib/hooks/use-referral-earnings';
import { useInvoices } from '@/lib/hooks/use-invoices';
import { useProjects } from '@/lib/hooks/use-projects';
import { groupByProject, monthlyTrend } from '@/lib/reports';
import { StatRow, StatTile } from '@/components/ui/StatTile';

export default function ReportsScreen() {
  const t = useT();
  const router = useRouter();
  const { companyId, company, role } = useActiveCompany();
  const currency = companyCurrency(company);

  const { data: pending } = usePendingApprovals(companyId ?? undefined);
  const { data: pendingExpenses } = usePendingExpenses(companyId ?? undefined);
  const reviewCount = (pending ?? []).length + (pendingExpenses ?? []).length;

  // Same lightweight, company-wide data sources the Analytics and Project P&L
  // sub-screens fetch — reused here only to derive a compact preview, never a
  // full breakdown.
  const { data: revenueEntries } = useCompanyRevenueEntries(companyId ?? undefined);
  const { data: referralEarnings } = useReferralEarnings(companyId ? { companyId } : {});
  const { data: invoices } = useInvoices({ companyId: companyId ?? '' });
  const { data: costs } = useCompanyProjectCosts(companyId ?? undefined);
  const { data: projects } = useProjects(companyId ?? undefined);

  const monthPoint = useMemo(
    () => monthlyTrend(revenueEntries ?? [], referralEarnings ?? [], invoices ?? [], costs ?? [], todayISO(), 1)[0],
    [revenueEntries, referralEarnings, invoices, costs],
  );

  // Projects currently running at a loss — the one number a manager actually
  // wants at a glance before opening the full per-project P&L.
  const deficitCount = useMemo(() => {
    const revenueByProject = groupByProject(revenueEntries ?? []);
    const referralsByProject = groupByProject(referralEarnings ?? []);
    const invoicesByProject = groupByProject(invoices ?? []);
    const costsByProject = groupByProject(costs ?? []);
    const today = todayISO();
    return (projects ?? []).filter((p) => {
      const revenueCents = (revenueByProject.get(p.id) ?? []).reduce((acc, r) => acc + (r.amount_cents ?? 0), 0);
      const referralCents = sumReferralEarnings(referralsByProject.get(p.id) ?? []);
      const costCents = (invoicesByProject.get(p.id) ?? [])
        .filter((i) => i.status === 'submitted' || i.status === 'partially_paid' || i.status === 'paid')
        .reduce((acc, i) => acc + (i.earned_cents ?? 0), 0);
      const projectCosts = costsByProject.get(p.id) ?? [];
      const fixedCostCents = costCumulative(projectCosts, today);
      const expenseCents = sumApprovedExpenses(projectCosts);
      return projectMargin(revenueCents, referralCents, costCents, fixedCostCents, expenseCents) < 0;
    }).length;
  }, [revenueEntries, referralEarnings, invoices, costs, projects]);

  // Manager/admin only. Guard the direct-URL case (the tab is already hidden for
  // freelancers) — all hooks above run so hook order stays stable.
  if (!canManage(role)) return <Redirect href="/(app)/(tabs)/home" />;

  return (
    <StackScreen title={t('tabs.nav.reports')}>
      <View style={styles.wrap}>
        <Card padding="none">
          <ListItem
            title={t('tabs.reports.rem')}
            subtitle={t('tabs.reports.remHint')}
            onPress={() => router.push('/reports/rem' as Href)}
          />
          <ListItem
            title={t('tabs.reports.companyFee')}
            subtitle={t('tabs.reports.companyFeeHint')}
            onPress={() => router.push('/reports/company-fee' as Href)}
          />
          <ListItem
            title={t('tabs.reports.license')}
            subtitle={t('tabs.reports.licenseHint')}
            onPress={() => router.push('/reports/license' as Href)}
            divider={false}
          />
        </Card>

        <Card padding="none">
          <ListItem
            title={t('tabs.reports.approvals')}
            subtitle={t('tabs.reports.approvalsNavHint')}
            trailing={reviewCount > 0 ? <Badge label={String(reviewCount)} status="warning" /> : undefined}
            onPress={() => router.push('/reports/approvals')}
            divider={false}
          />
        </Card>

        <Card padding="lg" style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Txt variant="heading">{t('tabs.reports.analytics')}</Txt>
            <Txt variant="caption" tone="textMuted">
              {t('tabs.reports.analyticsNavHint')}
            </Txt>
          </View>
          <StatRow>
            <StatTile label={t('tabs.reports.thisMonthRevenue')}>
              <Money cents={monthPoint?.revenueCents ?? 0} currency={currency} variant="heading" />
            </StatTile>
            <StatTile label={t('compb.pnl.margin')}>
              <Money
                cents={monthPoint?.marginCents ?? 0}
                currency={currency}
                variant="heading"
                tone={(monthPoint?.marginCents ?? 0) >= 0 ? 'success' : 'danger'}
              />
            </StatTile>
          </StatRow>
          <Button
            title={t('tabs.reports.seeMore')}
            variant="secondary"
            onPress={() => router.push('/reports/analytics')}
          />
        </Card>

        <Card padding="lg" style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Txt variant="heading">{t('tabs.reports.projectPnl')}</Txt>
            <Txt variant="caption" tone="textMuted">
              {t('tabs.reports.profitabilityNavHint')}
            </Txt>
          </View>
          <StatRow>
            <StatTile label={t('tabs.reports.projects')} value={String((projects ?? []).length)} />
            <StatTile
              label={t('tabs.reports.projectsInDeficit')}
              value={String(deficitCount)}
              tone={deficitCount > 0 ? 'danger' : 'text'}
            />
          </StatRow>
          <Button
            title={t('tabs.reports.seeMore')}
            variant="secondary"
            onPress={() => router.push('/reports/profitability')}
          />
        </Card>

        <Card padding="none">
          <ListItem title={t('tabs.reports.auditLog')} onPress={() => router.push('/audit')} divider={false} />
        </Card>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  previewCard: { gap: spacing.md },
  previewHeader: { gap: 2 },
});
