import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { EmptyState, Money, Row, StackScreen, TitledCard, Txt, spacing } from '@chrono/ui';
import { canManage, companyCurrency } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { shortMonthLabel } from '@/lib/date';
import type { StatsPeriod } from '@/lib/period-month';
import {
  estimateLicenseRevenueCents,
  licenseByProject,
  licenseMonthlyTrend,
  resolveLicenseTotal,
} from '@/lib/company-rem-reports';
import { useRemLinesByCompany } from '@/lib/hooks/use-rem';
import { useCompanyRevenueEntries } from '@/lib/hooks/use-revenue-entries';
import { useProjects } from '@/lib/hooks/use-projects';
import { PeriodMonthRail } from '@/components/reports/PeriodMonthRail';
import { SectionHeader } from '@/components/common/SectionHeader';
import { StatRow, StatTile } from '@/components/ui/StatTile';
import { ScreenLoader } from '@/components/common/ScreenLoader';

/** Company license carve-out revenues (product-service rem). */
export default function LicenseReportScreen() {
  const t = useT();
  const router = useRouter();
  const { companyId, company, role } = useActiveCompany();
  const currency = companyCurrency(company);
  const [period, setPeriod] = useState<StatsPeriod>('all');

  const feePct = company?.company_fee_pct ?? 0;
  const licensePct = company?.default_license_pct ?? 0;

  const { data: revenue, isLoading: loadingRev } = useCompanyRevenueEntries(companyId ?? undefined);
  const { data: projects, isLoading: loadingProjects } = useProjects(companyId ?? undefined);
  const remMonth = period === 'all' ? undefined : period;
  const { data: remLicenseLines, isLoading: loadingRem } = useRemLinesByCompany(
    companyId ?? undefined,
    { bucket: 'license', month: remMonth },
  );

  const projectRefs = projects ?? [];

  const remLicenseCents = useMemo(() => {
    // Only trust rem lines for a concrete month — "All" may be partial (rem not run every month).
    if (period === 'all') return null;
    const lines = remLicenseLines ?? [];
    if (lines.length === 0) return null;
    return lines.reduce((acc, l) => acc + (l.amount_cents ?? 0), 0);
  }, [remLicenseLines, period]);

  const estimated = useMemo(
    () => estimateLicenseRevenueCents(revenue ?? [], projectRefs, feePct, licensePct, period),
    [revenue, projectRefs, feePct, licensePct, period],
  );
  const licenseCents = resolveLicenseTotal({
    remLicenseCents,
    estimatedCents: estimated,
  });

  const byProject = useMemo(
    () => licenseByProject(revenue ?? [], projectRefs, feePct, licensePct, period),
    [revenue, projectRefs, feePct, licensePct, period],
  );

  const trend = useMemo(
    () =>
      licenseMonthlyTrend({
        revenueEntries: revenue ?? [],
        projects: projectRefs,
        companyFeePct: feePct,
        licensePct,
      }),
    [revenue, projectRefs, feePct, licensePct],
  );

  if (!canManage(role)) return <Redirect href="/(app)/(tabs)/home" />;

  const loading =
    (loadingRev && revenue == null) ||
    (loadingProjects && projects == null) ||
    (loadingRem && remLicenseLines == null);

  return (
    <StackScreen title={t('tabs.reports.license')} onBack={() => router.back()}>
      <View style={styles.wrap}>
        <PeriodMonthRail value={period} onChange={setPeriod} />
        {loading ? <ScreenLoader fill={false} /> : null}

        <TitledCard title={t('tabs.reports.licenseSummary')}>
          <Txt variant="caption" tone="textMuted">
            {remLicenseCents != null
              ? t('tabs.reports.licenseFromRem')
              : t('tabs.reports.licenseEstimated', { pct: licensePct })}
          </Txt>
          <StatRow>
            <StatTile label={t('tabs.reports.licenseTotal')}>
              <Money cents={licenseCents} currency={currency} variant="heading" />
            </StatTile>
            <StatTile label={t('rem.settings.defaultLicense')} value={`${licensePct}%`} />
            <StatTile
              label={t('tabs.reports.licenseProjects')}
              value={String(byProject.length)}
            />
          </StatRow>
        </TitledCard>

        <View style={styles.section}>
          <SectionHeader
            eyebrow={t('tabs.reports.profitability')}
            title={t('tabs.reports.licenseByProject')}
            count={byProject.length}
          />
          {byProject.length === 0 ? (
            <EmptyState
              icon="pricetag-outline"
              title={t('tabs.reports.licenseEmpty')}
              subtitle={t('tabs.reports.licenseEmptySubtitle')}
            />
          ) : (
            <TitledCard title={t('tabs.reports.licenseByProject')}>
              {byProject.map((row) => (
                <Row key={row.projectId} label={row.projectName}>
                  <View style={styles.projVals}>
                    <Money cents={row.licenseCents} currency={currency} />
                    <Txt variant="caption" tone="textMuted">
                      {t('tabs.reports.licenseOnRevenue')}
                    </Txt>
                    <Money cents={row.revenueCents} currency={currency} tone="textMuted" />
                  </View>
                </Row>
              ))}
            </TitledCard>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader eyebrow={t('tabs.reports.trends')} title={t('tabs.reports.last6Months')} />
          <TitledCard title={t('tabs.reports.licenseTrend')}>
            {trend.map((p) => (
              <Row key={p.month} label={shortMonthLabel(p.month)}>
                <Money cents={p.licenseCents} currency={currency} />
              </Row>
            ))}
          </TitledCard>
        </View>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg, paddingBottom: spacing.xl },
  section: { gap: spacing.md },
  projVals: { alignItems: 'flex-end', gap: 2 },
});
