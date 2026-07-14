import { StyleSheet, View } from 'react-native';
import { EmptyState, StackScreen, spacing, useResponsive } from '@chrono/ui';
import { companyCurrency } from '@chrono/sdk';

import { useActiveCompany } from '@/lib/active-company-context';
import { usePendingApprovals, useApproveEntry, useRejectEntry } from '@/lib/hooks/use-approvals';
import { useProjects } from '@/lib/hooks/use-projects';
import { ApprovalRow } from '@/components/approvals/ApprovalRow';
import { ProjectPnLCard } from '@/components/reports/ProjectPnLCard';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';

export default function ReportsScreen() {
  const { isWide } = useResponsive();
  const { companyId, company } = useActiveCompany();
  const currency = companyCurrency(company);

  const { data: pending, isLoading: loadingPending } = usePendingApprovals(companyId ?? undefined);
  const { data: projects, isLoading: loadingProjects } = useProjects(companyId ?? undefined);
  const approve = useApproveEntry();
  const reject = useRejectEntry();

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
          ) : projectList.length === 0 ? (
            <EmptyState icon="bar-chart-outline" title="No projects" subtitle="Create a project to see its profit and loss." />
          ) : (
            <View style={styles.grid}>
              {projectList.map((project) => (
                <View key={project.id} style={cellStyle}>
                  <ProjectPnLCard project={project} companyId={companyId ?? ''} currency={currency} />
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
