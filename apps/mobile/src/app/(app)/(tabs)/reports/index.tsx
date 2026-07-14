import { StyleSheet, View } from 'react-native';
import { EmptyState, StackScreen, Txt, spacing } from '@chrono/ui';
import { companyCurrency } from '@chrono/sdk';

import { useActiveCompany } from '@/lib/active-company-context';
import { usePendingApprovals, useApproveEntry, useRejectEntry } from '@/lib/hooks/use-approvals';
import { useProjects } from '@/lib/hooks/use-projects';
import { ApprovalRow } from '@/components/approvals/ApprovalRow';
import { ProjectPnLCard } from '@/components/reports/ProjectPnLCard';

export default function ReportsScreen() {
  const { companyId, company } = useActiveCompany();
  const currency = companyCurrency(company);

  const { data: pending } = usePendingApprovals(companyId ?? undefined);
  const { data: projects } = useProjects(companyId ?? undefined);
  const approve = useApproveEntry();
  const reject = useRejectEntry();

  return (
    <StackScreen title="Reports">
      <View style={styles.wrap}>
        <View style={styles.section}>
          <Txt variant="heading">Pending approvals</Txt>
          {(pending ?? []).length === 0 ? (
            <EmptyState icon="checkmark-done-outline" title="All caught up" subtitle="No time entries awaiting approval." />
          ) : (
            (pending ?? []).map((entry) => (
              <ApprovalRow
                key={entry.id}
                entry={entry}
                onApprove={() => approve.mutate(entry.id)}
                onReject={() => reject.mutate(entry.id, 'Rejected')}
                isBusy={approve.isPending || reject.isPending}
              />
            ))
          )}
        </View>

        <View style={styles.section}>
          <Txt variant="heading">Project P&amp;L</Txt>
          {(projects ?? []).length === 0 ? (
            <EmptyState icon="bar-chart-outline" title="No projects" subtitle="Create a project to see its profit and loss." />
          ) : (
            (projects ?? []).map((project) => (
              <ProjectPnLCard
                key={project.id}
                project={project}
                companyId={companyId ?? ''}
                currency={currency}
              />
            ))
          )}
        </View>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  section: { gap: spacing.md },
});
