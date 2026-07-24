import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Money, Row, StackScreen, TitledCard, Txt, spacing } from '@chrono/ui';
import { canManage, companyCurrency } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { shortMonthLabel } from '@/lib/date';
import type { StatsPeriod } from '@/lib/period-month';
import {
  companyPoolCostsCents,
  estimateCompanyFeeCents,
  feeVsCostsTrend,
  resolveCompanyFeeTotal,
} from '@/lib/company-rem-reports';
import { useCompanyFeeReserve } from '@/lib/hooks/use-rem';
import { useCompanyProjectCosts } from '@/lib/hooks/use-project-costs';
import { useCompanyRevenueEntries } from '@/lib/hooks/use-revenue-entries';
import { useProjects } from '@/lib/hooks/use-projects';
import { PeriodMonthRail } from '@/components/reports/PeriodMonthRail';
import { SectionHeader } from '@/components/common/SectionHeader';
import { StatRow, StatTile } from '@/components/ui/StatTile';
import { ScreenLoader } from '@/components/common/ScreenLoader';

/** Company fee reserve vs company pool costs for a selectable period. */
export default function CompanyFeeReportScreen() {
  const t = useT();
  const router = useRouter();
  const { companyId, company, role } = useActiveCompany();
  const currency = companyCurrency(company);
  const [period, setPeriod] = useState<StatsPeriod>('all');

  const { data: reserve, isLoading: loadingReserve } = useCompanyFeeReserve(companyId ?? undefined);
  const { data: costs, isLoading: loadingCosts } = useCompanyProjectCosts(companyId ?? undefined);
  const { data: revenue, isLoading: loadingRev } = useCompanyRevenueEntries(companyId ?? undefined);
  const { data: projects, isLoading: loadingProjects } = useProjects(companyId ?? undefined);

  const feePct = company?.company_fee_pct ?? 0;
  const projectRefs = projects ?? [];

  const reserveForPeriod = useMemo(() => {
    const rows = reserve ?? [];
    // Only trust the ledger for a concrete month — "All" may miss months without rem compute.
    if (period === 'all') return null;
    const hit = rows.find((r) => r.period_month.slice(0, 7) === period);
    return hit ? hit.amount_cents : null;
  }, [reserve, period]);

  const estimatedFee = useMemo(
    () => estimateCompanyFeeCents(revenue ?? [], projectRefs, feePct, period),
    [revenue, projectRefs, feePct, period],
  );
  const feeCents = resolveCompanyFeeTotal({
    reserveCents: reserveForPeriod,
    estimatedCents: estimatedFee,
  });
  const costsCents = useMemo(
    () => companyPoolCostsCents(costs ?? [], period),
    [costs, period],
  );
  const netCents = feeCents - costsCents;
  const coveragePct = costsCents > 0 ? Math.round((feeCents / costsCents) * 100) : feeCents > 0 ? 100 : 0;

  const trend = useMemo(
    () =>
      feeVsCostsTrend({
        costs: costs ?? [],
        feeReserve: reserve ?? [],
        revenueEntries: revenue ?? [],
        projects: projectRefs,
        companyFeePct: feePct,
      }),
    [costs, reserve, revenue, projectRefs, feePct],
  );

  if (!canManage(role)) return <Redirect href="/(app)/(tabs)/home" />;

  const loading =
    (loadingReserve && reserve == null) ||
    (loadingCosts && costs == null) ||
    (loadingRev && revenue == null) ||
    (loadingProjects && projects == null);

  return (
    <StackScreen title={t('tabs.reports.companyFee')} onBack={() => router.back()}>
      <View style={styles.wrap}>
        <PeriodMonthRail value={period} onChange={setPeriod} />
        {loading ? <ScreenLoader fill={false} /> : null}
        <TitledCard title={t('tabs.reports.companyFeeSummary')}>
          <Txt variant="caption" tone="textMuted">
            {reserveForPeriod != null
              ? t('tabs.reports.companyFeeFromReserve')
              : t('tabs.reports.companyFeeEstimated', { pct: feePct })}
          </Txt>
          <StatRow>
            <StatTile label={t('tabs.reports.companyFeeAccrued')}>
              <Money cents={feeCents} currency={currency} variant="heading" />
            </StatTile>
            <StatTile label={t('tabs.reports.companyCosts')}>
              <Money cents={costsCents} currency={currency} variant="heading" tone="textMuted" />
            </StatTile>
            <StatTile label={t('tabs.reports.feeCoverage')}>
              <Money
                cents={netCents}
                currency={currency}
                variant="heading"
                tone={netCents >= 0 ? 'success' : 'danger'}
              />
            </StatTile>
            <StatTile label={t('tabs.reports.feeCoveragePct')} value={`${coveragePct}%`} />
          </StatRow>
        </TitledCard>

        <View style={styles.section}>
          <SectionHeader eyebrow={t('tabs.reports.trends')} title={t('tabs.reports.last6Months')} />
          <TitledCard title={t('tabs.reports.feeVsCostsTrend')}>
            {trend.map((p) => (
              <Row key={p.month} label={shortMonthLabel(p.month)}>
                <View style={styles.trendVals}>
                  <Money cents={p.feeCents} currency={currency} tone="textMuted" />
                  <Txt variant="caption" tone="textFaint">
                    /
                  </Txt>
                  <Money cents={p.costsCents} currency={currency} tone="textMuted" />
                  <Money
                    cents={p.netCents}
                    currency={currency}
                    tone={p.netCents >= 0 ? 'success' : 'danger'}
                  />
                </View>
              </Row>
            ))}
            <Txt variant="caption" tone="textMuted">
              {t('tabs.reports.feeVsCostsLegend')}
            </Txt>
          </TitledCard>
        </View>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg, paddingBottom: spacing.xl },
  section: { gap: spacing.md },
  trendVals: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
});
