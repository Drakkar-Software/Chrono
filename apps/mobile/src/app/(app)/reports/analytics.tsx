import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { CardGrid, Card, IconButton, Money, Row, Segmented, StackScreen, Txt, spacing, useResponsive } from '@chrono/ui';
import { canManage, companyCurrency, displayName, expensesOwedByUser } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { todayISO } from '@/lib/date';
import { exportCsv, invoicesCsv, timeEntriesCsv } from '@/lib/csv-export';
import { useCompanyRevenueEntries } from '@/lib/hooks/use-revenue-entries';
import { useCompanyProjectCosts } from '@/lib/hooks/use-project-costs';
import { useReferralEarnings } from '@/lib/hooks/use-referral-earnings';
import { useInvoices } from '@/lib/hooks/use-invoices';
import { useTimeEntries } from '@/lib/hooks/use-time-entries';
import { useCompanyMembers } from '@/lib/hooks/use-company-members';
import {
  RANGE_OPTIONS,
  inRange,
  monthlyTrend,
  rangeBounds,
  summarizeFreelancers,
  summarizeUtilization,
  type RangePreset,
} from '@/lib/reports';
import { TrendsCard } from '@/components/reports/TrendsCard';
import { TagBreakdown } from '@/components/reports/TagBreakdown';
import { FreelancerBreakdown } from '@/components/reports/FreelancerBreakdown';
import { CapacityCard } from '@/components/reports/CapacityCard';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';

export default function AnalyticsScreen() {
  const t = useT();
  const router = useRouter();
  const { isWide } = useResponsive();
  const { companyId, company, role } = useActiveCompany();
  const currency = companyCurrency(company);

  const [preset, setPreset] = useState<RangePreset>('this_month');
  const range = useMemo(() => rangeBounds(preset, todayISO()), [preset]);

  const {
    data: revenueEntries,
    error: revenueEntriesError,
    refetch: refetchRevenueEntries,
  } = useCompanyRevenueEntries(companyId ?? undefined);
  const {
    data: referralEarnings,
    error: referralEarningsError,
    refetch: refetchReferralEarnings,
  } = useReferralEarnings(companyId ? { companyId } : {});
  const {
    data: invoices,
    error: invoicesError,
    refetch: refetchInvoicesData,
  } = useInvoices({ companyId: companyId ?? '' });
  const {
    data: costs,
    error: costsError,
    refetch: refetchCosts,
  } = useCompanyProjectCosts(companyId ?? undefined);

  // Approved billable time in-range — one company-scoped query, sliced per user.
  const {
    data: approvedEntries,
    isLoading: loadingApproved,
    error: approvedError,
    refetch: refetchApproved,
  } = useTimeEntries({
    companyId: companyId ?? '',
    status: 'approved',
    billable: true,
    from: range.from,
    to: range.to,
  });
  const {
    data: members,
    isLoading: loadingMembers,
    error: membersError,
    refetch: refetchMembers,
  } = useCompanyMembers(companyId ?? undefined);

  const freelancerRows = useMemo(() => {
    const invoicesInRange = (invoices ?? []).filter((inv) => inRange(inv.period_month, range));
    return summarizeFreelancers(approvedEntries ?? [], invoicesInRange);
  }, [approvedEntries, invoices, range]);

  const utilizationRows = useMemo(
    () => summarizeUtilization(freelancerRows, members ?? [], range),
    [freelancerRows, members, range],
  );

  const owedByUser = useMemo(() => expensesOwedByUser(costs ?? []), [costs]);

  // Six-month revenue/cost/margin trend — independent of the range preset above,
  // built from the company-wide data already fetched (no extra queries).
  const trend = useMemo(
    () => monthlyTrend(revenueEntries ?? [], referralEarnings ?? [], invoices ?? [], costs ?? [], todayISO(), 6),
    [revenueEntries, referralEarnings, invoices, costs],
  );

  const breakdownLoading =
    (loadingApproved && approvedEntries == null) || (loadingMembers && members == null);

  // One aggregate error surface for every analytics/breakdown data source — a
  // silent fetch failure here would otherwise render as real zeros in a
  // financial dashboard, which is actively misleading.
  const dataSources = [
    { error: revenueEntriesError, refetch: refetchRevenueEntries },
    { error: referralEarningsError, refetch: refetchReferralEarnings },
    { error: invoicesError, refetch: refetchInvoicesData },
    { error: costsError, refetch: refetchCosts },
    { error: approvedError, refetch: refetchApproved },
    { error: membersError, refetch: refetchMembers },
  ];
  const dataError = dataSources.find((d) => d.error)?.error;
  const retryAllData = () => {
    for (const source of dataSources) if (source.error) void source.refetch();
  };

  // Manager/admin only. Guard the direct-URL case — all hooks above run so
  // hook order stays stable.
  if (!canManage(role)) return <Redirect href="/(app)/(tabs)/home" />;

  return (
    <StackScreen title={t('tabs.reports.analytics')} onBack={() => router.back()} wide>
      <View style={styles.wrap}>
        <View style={styles.toolbar}>
          <Segmented options={RANGE_OPTIONS} value={preset} onValueChange={(v) => setPreset(v as RangePreset)} />
          <View style={styles.toolbarActions}>
            <IconButton
              name="download-outline"
              accessibilityLabel={t('tabs.reports.exportTime')}
              onPress={() => void exportCsv(`chrono-time-${range.from ?? 'all'}.csv`, timeEntriesCsv(approvedEntries ?? []))}
            />
            <IconButton
              name="receipt-outline"
              accessibilityLabel={t('tabs.reports.exportInvoices')}
              onPress={() => void exportCsv('chrono-invoices.csv', invoicesCsv(invoices ?? []))}
            />
          </View>
        </View>

        {dataError ? (
          <ErrorState error={dataError} title={t('tabs.reports.dataError')} onRetry={retryAllData} />
        ) : null}

        <View style={styles.section}>
          <SectionHeader eyebrow={t('tabs.reports.trends')} title={t('tabs.reports.last6Months')} />
          <TrendsCard points={trend} currency={currency} />
        </View>

        <CardGrid minColumnWidth={isWide ? 360 : 999}>
          <View style={styles.block}>
            <SectionHeader eyebrow={t('tabs.reports.people')} title={t('tabs.reports.freelancerBreakdown')} count={freelancerRows.length} />
            <Txt variant="caption" tone="textMuted">
              {t('tabs.reports.breakdownCaption')}
            </Txt>
            {breakdownLoading ? (
              <ScreenLoader />
            ) : (
              <FreelancerBreakdown rows={freelancerRows} members={members ?? []} currency={currency} />
            )}
          </View>

          <View style={styles.block}>
            <SectionHeader eyebrow={t('tabs.reports.people')} title={t('compb.capacity.title')} />
            {breakdownLoading ? <ScreenLoader /> : <CapacityCard rows={utilizationRows} members={members ?? []} />}
          </View>

          <View style={styles.block}>
            <SectionHeader eyebrow={t('tabs.reports.categories')} title={t('tabs.reports.byTag')} />
            {breakdownLoading ? <ScreenLoader /> : <TagBreakdown entries={approvedEntries ?? []} />}
          </View>

          {Object.keys(owedByUser).length > 0 ? (
            <View style={styles.block}>
              <SectionHeader eyebrow={t('tabs.reports.people')} title={t('comp.cost.owed')} />
              <Card padding="lg" style={styles.owedCard}>
                {Object.entries(owedByUser).map(([userId, cents]) => (
                  <Row key={userId} label={displayName((members ?? []).find((m) => m.user_id === userId)?.profile)}>
                    <Money cents={cents} currency={currency} />
                  </Row>
                ))}
              </Card>
            </View>
          ) : null}
        </CardGrid>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  section: { gap: spacing.md },
  block: { gap: spacing.sm },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  toolbarActions: { flexDirection: 'row', gap: spacing.xs },
  owedCard: { gap: spacing.xs },
});
