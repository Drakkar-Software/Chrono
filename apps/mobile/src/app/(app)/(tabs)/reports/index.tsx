import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import {
  Button,
  Card,
  CardGrid,
  EmptyState,
  IconButton,
  Money,
  Row,
  Segmented,
  StackScreen,
  Txt,
  borders,
  spacing,
  useResponsive,
  useTheme,
} from '@chrono/ui';
import { canManage, companyCurrency, displayName, expensesOwedByUser } from '@chrono/sdk';
import type { InvoiceWithRelations, ProjectExpense, ProjectFixedCost, ProjectMember, ReferralEarning, RevenueEntry } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { todayISO } from '@/lib/date';
import { exportCsv, invoicesCsv, timeEntriesCsv } from '@/lib/csv-export';
import { usePendingApprovals, useApproveEntry, useRejectEntry } from '@/lib/hooks/use-approvals';
import { useProjects } from '@/lib/hooks/use-projects';
import { useCompanyRevenueEntries } from '@/lib/hooks/use-revenue-entries';
import { useCompanyProjectFixedCosts } from '@/lib/hooks/use-project-fixed-costs';
import { useCompanyExpenses, usePendingExpenses, useExpenseMutations } from '@/lib/hooks/use-project-expenses';
import { useReferralEarnings } from '@/lib/hooks/use-referral-earnings';
import { useInvoices } from '@/lib/hooks/use-invoices';
import { useTimeEntries } from '@/lib/hooks/use-time-entries';
import { useCompanyMembers } from '@/lib/hooks/use-company-members';
import { useCompanyProjectMembers } from '@/lib/hooks/use-project-members';
import {
  RANGE_OPTIONS,
  inRange,
  monthlyTrend,
  rangeBounds,
  summarizeFreelancers,
  summarizeUtilization,
  uninvoicedTimeByProject,
  type RangePreset,
} from '@/lib/reports';
import { ApprovalRow } from '@/components/approvals/ApprovalRow';
import { ExpenseRow } from '@/components/expenses/ExpenseRow';
import { ProjectPnLCard } from '@/components/reports/ProjectPnLCard';
import { TrendsCard } from '@/components/reports/TrendsCard';
import { TagBreakdown } from '@/components/reports/TagBreakdown';
import { FreelancerBreakdown } from '@/components/reports/FreelancerBreakdown';
import { CapacityCard } from '@/components/reports/CapacityCard';
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
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { isWide } = useResponsive();
  const { companyId, company, role } = useActiveCompany();
  const currency = companyCurrency(company);

  const [preset, setPreset] = useState<RangePreset>('this_month');
  const range = useMemo(() => rangeBounds(preset, todayISO()), [preset]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Id of the single entry currently being approved/rejected, so only that row
  // shows a busy state — one action no longer locks the whole queue.
  const [actingId, setActingId] = useState<string | null>(null);

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

  const {
    data: pendingExpenses,
    error: pendingExpensesError,
    refetch: refetchPendingExpenses,
  } = usePendingExpenses(companyId ?? undefined);
  const expenseMut = useExpenseMutations();

  // Company-scoped P&L inputs fetched ONCE, then sliced per project below —
  // avoids the 3-query-per-card fan-out (N+1) the cards used to trigger.
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
    data: fixedCosts,
    error: fixedCostsError,
    refetch: refetchFixedCosts,
  } = useCompanyProjectFixedCosts(companyId ?? undefined);
  const {
    data: expenses,
    error: expensesError,
    refetch: refetchExpenses,
  } = useCompanyExpenses(companyId ?? undefined);

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

  // Approved billable time not yet invoiced, valued into each project's "net
  // available funding" — a live preview of what's really left to spend.
  // All-time (no range): what's owed doesn't reset with the report's window.
  const {
    data: uninvoicedTimeEntries,
    error: uninvoicedTimeError,
    refetch: refetchUninvoicedTime,
  } = useTimeEntries({
    companyId: companyId ?? '',
    status: 'approved',
    billable: true,
    uninvoiced: true,
  });
  const {
    data: projectMembers,
    error: projectMembersError,
    refetch: refetchProjectMembers,
  } = useCompanyProjectMembers(companyId ?? undefined);

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
  const fixedCostsByProject = useMemo(
    () => groupByProject<ProjectFixedCost>(fixedCosts ?? []),
    [fixedCosts],
  );
  const expensesByProject = useMemo(
    () => groupByProject<ProjectExpense>(expenses ?? []),
    [expenses],
  );
  const projectMembersByProject = useMemo(
    () => groupByProject<ProjectMember>(projectMembers ?? []),
    [projectMembers],
  );
  const uninvoicedTimeByProjectId = useMemo(
    () => uninvoicedTimeByProject(uninvoicedTimeEntries ?? [], projectMembersByProject),
    [uninvoicedTimeEntries, projectMembersByProject],
  );

  const freelancerRows = useMemo(() => {
    const invoicesInRange = (invoices ?? []).filter((inv) => inRange(inv.period_month, range));
    return summarizeFreelancers(approvedEntries ?? [], invoicesInRange);
  }, [approvedEntries, invoices, range]);

  const utilizationRows = useMemo(
    () => summarizeUtilization(freelancerRows, members ?? [], range),
    [freelancerRows, members, range],
  );

  const owedByUser = useMemo(() => expensesOwedByUser(expenses ?? []), [expenses]);

  // Six-month revenue/cost/margin trend — independent of the range preset above,
  // built from the company-wide data already fetched (no extra queries).
  const trend = useMemo(
    () => monthlyTrend(revenueEntries ?? [], referralEarnings ?? [], invoices ?? [], fixedCosts ?? [], todayISO(), 6),
    [revenueEntries, referralEarnings, invoices, fixedCosts],
  );

  const pendingList = pending ?? [];
  const pendingExpenseList = pendingExpenses ?? [];
  const projectList = projects ?? [];
  const breakdownLoading =
    (loadingApproved && approvedEntries == null) || (loadingMembers && members == null);

  // One aggregate error surface for every analytics/breakdown data source — a
  // silent fetch failure here would otherwise render as real zeros in a
  // financial dashboard, which is actively misleading.
  const dataSources = [
    { error: revenueEntriesError, refetch: refetchRevenueEntries },
    { error: referralEarningsError, refetch: refetchReferralEarnings },
    { error: invoicesError, refetch: refetchInvoicesData },
    { error: fixedCostsError, refetch: refetchFixedCosts },
    { error: expensesError, refetch: refetchExpenses },
    { error: approvedError, refetch: refetchApproved },
    { error: membersError, refetch: refetchMembers },
    { error: pendingExpensesError, refetch: refetchPendingExpenses },
    { error: uninvoicedTimeError, refetch: refetchUninvoicedTime },
    { error: projectMembersError, refetch: refetchProjectMembers },
  ];
  const dataError = dataSources.find((d) => d.error)?.error;
  const retryAllData = () => {
    for (const source of dataSources) if (source.error) void source.refetch();
  };

  const busy = approve.isPending || reject.isPending;
  const allSelected = pendingList.length > 0 && selected.size === pendingList.length;
  const reviewCount = pendingList.length + pendingExpenseList.length;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(pendingList.map((e) => e.id)));
  };
  const approveSelected = async () => {
    const ids = [...selected];
    // Don't let one failure abort the rest — settle all, then keep any that
    // failed selected so the manager can see and retry them.
    const results = await Promise.allSettled(ids.map((id) => approve.mutateAsync(id)));
    const failed = new Set(ids.filter((_, i) => results[i].status === 'rejected'));
    setSelected(failed);
    await refetchPending();
  };
  const approveOne = async (id: string) => {
    deselect(id);
    setActingId(id);
    try {
      await approve.mutateAsync(id);
    } finally {
      setActingId(null);
    }
  };
  const rejectOne = async (id: string, reason: string) => {
    deselect(id);
    setActingId(id);
    try {
      await reject.mutateAsync(id, reason);
    } finally {
      setActingId(null);
    }
  };
  // Drop an id from the selection when it's resolved individually, so the
  // "Approve selected" count and select-all state stay honest.
  const deselect = (id: string) => {
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Manager/admin only. Guard the direct-URL case (the tab is already hidden for
  // freelancers) — all hooks above run so hook order stays stable.
  if (!canManage(role)) return <Redirect href="/(app)/(tabs)/home" />;

  return (
    <StackScreen title={t('tabs.nav.reports')} wide>
      <View style={styles.wrap}>
        {/* Action queue: a workflow a manager must act on, not a reporting
            widget — kept distinct from (and above) the read-only analytics
            below. Only rendered while there's actually something to review. */}
        {loadingPending && pending == null ? (
          <ScreenLoader />
        ) : pendingError && pending == null ? (
          <ErrorState
            error={pendingError}
            title={t('tabs.reports.approvalsError')}
            onRetry={() => {
              void refetchPending();
            }}
          />
        ) : reviewCount > 0 ? (
          <Card padding="lg" style={[styles.queueCard, { borderColor: colors.warning }]}>
            <SectionHeader
              eyebrow={t('tabs.reports.actionQueue')}
              title={t('tabs.reports.needsReview', { n: reviewCount })}
              action={
                pendingList.length > 0 ? (
                  <View style={styles.bulkActions}>
                    <Button
                      title={allSelected ? t('tabs.reports.clear') : t('tabs.reports.selectAll')}
                      size="sm"
                      variant="ghost"
                      onPress={toggleSelectAll}
                      disabled={busy}
                    />
                    <Button
                      title={t('tabs.reports.approveSelected', { n: selected.size })}
                      size="sm"
                      variant="primary"
                      onPress={approveSelected}
                      loading={approve.isPending}
                      disabled={selected.size === 0}
                    />
                  </View>
                ) : undefined
              }
            />
            {pendingList.length > 0 ? (
              <CardGrid minColumnWidth={280}>
                {pendingList.map((entry) => (
                  <ApprovalRow
                    key={entry.id}
                    entry={entry}
                    selectable
                    selected={selected.has(entry.id)}
                    onToggleSelect={() => toggleSelect(entry.id)}
                    onApprove={() => void approveOne(entry.id)}
                    onReject={(reason) => void rejectOne(entry.id, reason)}
                    isBusy={actingId === entry.id}
                  />
                ))}
              </CardGrid>
            ) : null}
            {pendingExpenseList.length > 0 ? (
              <CardGrid minColumnWidth={280}>
                {pendingExpenseList.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    currency={currency}
                    submitter={(members ?? []).find((m) => m.user_id === expense.user_id)?.profile}
                    canModerate
                    onApprove={() => void expenseMut.approve(expense.id).then(() => refetchPendingExpenses())}
                    onReject={(reason) => void expenseMut.reject(expense.id, reason).then(() => refetchPendingExpenses())}
                    isBusy={expenseMut.isPending}
                  />
                ))}
              </CardGrid>
            ) : null}
          </Card>
        ) : null}

        {/* Compact toolbar: range scope + secondary actions kept small so they
            don't compete with the trend chart below. */}
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
            <IconButton
              name="time-outline"
              accessibilityLabel={t('tabs.reports.auditLog')}
              onPress={() => router.push('/audit')}
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
            {breakdownLoading ? <ScreenLoader /> : <CapacityCard rows={utilizationRows} members={members ?? []} /> }
          </View>

          <View style={styles.block}>
            <SectionHeader eyebrow={t('tabs.reports.categories')} title={t('tabs.reports.byTag')} />
            {breakdownLoading ? <ScreenLoader /> : <TagBreakdown entries={approvedEntries ?? []} />}
          </View>

          {Object.keys(owedByUser).length > 0 ? (
            <View style={styles.block}>
              <SectionHeader eyebrow={t('tabs.reports.people')} title={t('comp.expense.owed')} />
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

        <View style={styles.section}>
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
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  section: { gap: spacing.md },
  block: { gap: spacing.sm },
  queueCard: { gap: spacing.md, borderWidth: borders.thick },
  bulkActions: { flexDirection: 'row', gap: spacing.sm, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  toolbarActions: { flexDirection: 'row', gap: spacing.xs },
  owedCard: { gap: spacing.xs },
});
