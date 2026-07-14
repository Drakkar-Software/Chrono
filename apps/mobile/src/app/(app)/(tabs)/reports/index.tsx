import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { EmptyState, StackScreen, spacing, useResponsive } from '@chrono/ui';
import { companyCurrency } from '@chrono/sdk';
import type { InvoiceWithRelations, ReferralEarning, RevenueEntry } from '@chrono/sdk';

import { useActiveCompany } from '@/lib/active-company-context';
import { usePendingApprovals, useApproveEntry, useRejectEntry } from '@/lib/hooks/use-approvals';
import { useProjects } from '@/lib/hooks/use-projects';
import { useCompanyRevenueEntries } from '@/lib/hooks/use-revenue-entries';
import { useReferralEarnings } from '@/lib/hooks/use-referral-earnings';
import { useInvoices } from '@/lib/hooks/use-invoices';
import { ApprovalRow } from '@/components/approvals/ApprovalRow';
import { ProjectPnLCard } from '@/components/reports/ProjectPnLCard';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';

/** Bucket rows by their `project_id` for O(1) per-project lookup. */
function groupByProject<T extends { project_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const arr = map.get(row.project_id);
    if (arr) arr.push(row);
    else map.set(row.project_id, [row]);
  }
  return map;
}

export default function ReportsScreen() {
  const { isWide } = useResponsive();
  const { companyId, company } = useActiveCompany();
  const currency = companyCurrency(company);

  const {
    data: pending,
    isLoading: loadingPending,
    error: pendingError,
    refetch: refetchPending,
  } = usePendingApprovals(companyId ?? undefined);
  const {
    data: projects,
    isLoading: loadingProjects,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjects(companyId ?? undefined);
  const approve = useApproveEntry();
  const reject = useRejectEntry();

  // Company-scoped P&L inputs fetched ONCE, then sliced per project below —
  // avoids the 3-query-per-card fan-out (N+1) the cards used to trigger.
  const { data: revenueEntries } = useCompanyRevenueEntries(companyId ?? undefined);
  const { data: referralEarnings } = useReferralEarnings(companyId ? { companyId } : {});
  const { data: invoices } = useInvoices({ companyId: companyId ?? '' });

  const revenueByProject = useMemo(
    () => groupByProject<RevenueEntry>(revenueEntries ?? []),
    [revenueEntries],
  );
  const referralsByProject = useMemo(
    () => groupByProject<ReferralEarning>(referralEarnings ?? []),
    [referralEarnings],
  );
  const invoicesByProject = useMemo(
    () => groupByProject<InvoiceWithRelations>(invoices ?? []),
    [invoices],
  );

  const pendingList = pending ?? [];
  const projectList = projects ?? [];
  const cellStyle = [styles.cell, isWide ? styles.cellWide : styles.cellFull];

  return (
    <StackScreen title="Reports">
      <View style={styles.wrap}>
        <View style={styles.section}>
          <SectionHeader eyebrow="Review" title="Pending approvals" count={pendingList.length} />
          {loadingPending && pending == null ? (
            <ScreenLoader />
          ) : pendingError && pending == null ? (
            <ErrorState
              error={pendingError}
              title="Couldn't load approvals"
              onRetry={() => {
                void refetchPending();
              }}
            />
          ) : pendingList.length === 0 ? (
            <EmptyState icon="checkmark-done-outline" title="All caught up" subtitle="No time entries awaiting approval." />
          ) : (
            <View style={styles.grid}>
              {pendingList.map((entry) => (
                <View key={entry.id} style={cellStyle}>
                  <ApprovalRow
                    entry={entry}
                    onApprove={() => approve.mutate(entry.id)}
                    onReject={() => reject.mutate(entry.id, 'Rejected')}
                    isBusy={approve.isPending || reject.isPending}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader eyebrow="Profitability" title="Project P&amp;L" count={projectList.length} />
          {loadingProjects && projects == null ? (
            <ScreenLoader />
          ) : projectsError && projects == null ? (
            <ErrorState
              error={projectsError}
              title="Couldn't load projects"
              onRetry={() => {
                void refetchProjects();
              }}
            />
          ) : projectList.length === 0 ? (
            <EmptyState icon="bar-chart-outline" title="No projects" subtitle="Create a project to see its profit and loss." />
          ) : (
            <View style={styles.grid}>
              {projectList.map((project) => (
                <View key={project.id} style={cellStyle}>
                  <ProjectPnLCard
                    project={project}
                    currency={currency}
                    revenueEntries={revenueByProject.get(project.id) ?? []}
                    referralEarnings={referralsByProject.get(project.id) ?? []}
                    invoices={invoicesByProject.get(project.id) ?? []}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  section: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { flexGrow: 1 },
  cellWide: { flexBasis: '48%', minWidth: 280 },
  cellFull: { flexBasis: '100%' },
});
