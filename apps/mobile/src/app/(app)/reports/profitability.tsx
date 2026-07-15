import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { CardGrid, EmptyState, StackScreen, spacing } from '@chrono/ui';
import { canManage, companyCurrency } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { useProjects } from '@/lib/hooks/use-projects';
import { useCompanyRevenueEntries } from '@/lib/hooks/use-revenue-entries';
import { useCompanyProjectFixedCosts } from '@/lib/hooks/use-project-fixed-costs';
import { useCompanyExpenses } from '@/lib/hooks/use-project-expenses';
import { useReferralEarnings } from '@/lib/hooks/use-referral-earnings';
import { useInvoices } from '@/lib/hooks/use-invoices';
import { useTimeEntries } from '@/lib/hooks/use-time-entries';
import { useCompanyProjectMembers } from '@/lib/hooks/use-project-members';
import { groupByProject, uninvoicedTimeByProject } from '@/lib/reports';
import { ProjectPnLCard } from '@/components/reports/ProjectPnLCard';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';

export default function ProfitabilityScreen() {
  const t = useT();
  const router = useRouter();
  const { companyId, company, role } = useActiveCompany();
  const currency = companyCurrency(company);

  const {
    data: projects,
    isLoading: loadingProjects,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjects(companyId ?? undefined);

  // Company-scoped P&L inputs fetched ONCE, then sliced per project below —
  // avoids the 3-query-per-card fan-out (N+1) the cards used to trigger.
  const { data: revenueEntries } = useCompanyRevenueEntries(companyId ?? undefined);
  const { data: referralEarnings } = useReferralEarnings(companyId ? { companyId } : {});
  const { data: invoices } = useInvoices({ companyId: companyId ?? '' });
  const { data: fixedCosts } = useCompanyProjectFixedCosts(companyId ?? undefined);
  const { data: expenses } = useCompanyExpenses(companyId ?? undefined);

  // Approved billable time not yet invoiced, valued into each project's "net
  // available funding" — a live preview of what's really left to spend.
  // All-time (no range): what's owed doesn't reset with the report's window.
  const { data: uninvoicedTimeEntries } = useTimeEntries({
    companyId: companyId ?? '',
    status: 'approved',
    billable: true,
    uninvoiced: true,
  });
  const { data: projectMembers } = useCompanyProjectMembers(companyId ?? undefined);

  const revenueByProject = useMemo(() => groupByProject(revenueEntries ?? []), [revenueEntries]);
  const referralsByProject = useMemo(() => groupByProject(referralEarnings ?? []), [referralEarnings]);
  const invoicesByProject = useMemo(() => groupByProject(invoices ?? []), [invoices]);
  const fixedCostsByProject = useMemo(() => groupByProject(fixedCosts ?? []), [fixedCosts]);
  const expensesByProject = useMemo(() => groupByProject(expenses ?? []), [expenses]);
  const projectMembersByProject = useMemo(() => groupByProject(projectMembers ?? []), [projectMembers]);
  const uninvoicedTimeByProjectId = useMemo(
    () => uninvoicedTimeByProject(uninvoicedTimeEntries ?? [], projectMembersByProject),
    [uninvoicedTimeEntries, projectMembersByProject],
  );

  const projectList = projects ?? [];

  // Manager/admin only. Guard the direct-URL case — all hooks above run so
  // hook order stays stable.
  if (!canManage(role)) return <Redirect href="/(app)/(tabs)/home" />;

  return (
    <StackScreen title={t('tabs.reports.projectPnl')} onBack={() => router.back()} wide>
      <View style={styles.wrap}>
        <SectionHeader eyebrow={t('tabs.reports.profitability')} title={t('tabs.reports.projectPnl')} count={projectList.length} />
        {loadingProjects && projects == null ? (
          <ScreenLoader />
        ) : projectsError && projects == null ? (
          <ErrorState
            error={projectsError}
            title={t('tabs.projects.loadError')}
            onRetry={() => {
              void refetchProjects();
            }}
          />
        ) : projectList.length === 0 ? (
          <EmptyState icon="bar-chart-outline" title={t('tabs.projects.empty')} subtitle={t('tabs.reports.projectsEmptySubtitle')} />
        ) : (
          <CardGrid minColumnWidth={280}>
            {projectList.map((project) => (
              <ProjectPnLCard
                key={project.id}
                project={project}
                currency={currency}
                revenueEntries={revenueByProject.get(project.id) ?? []}
                referralEarnings={referralsByProject.get(project.id) ?? []}
                invoices={invoicesByProject.get(project.id) ?? []}
                fixedCosts={fixedCostsByProject.get(project.id) ?? []}
                expenses={expensesByProject.get(project.id) ?? []}
                uninvoicedTimeCents={uninvoicedTimeByProjectId.get(project.id) ?? 0}
              />
            ))}
          </CardGrid>
        )}
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
});
