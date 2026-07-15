import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Button, CardGrid, EmptyState, Segmented, StackScreen, Txt, spacing } from '@chrono/ui';
import { canManage, companyCurrency } from '@chrono/sdk';
import type { InvoiceWithRelations, ProjectFixedCost, ReferralEarning, RevenueEntry } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { todayISO } from '@/lib/date';
import { exportCsv, invoicesCsv, timeEntriesCsv } from '@/lib/csv-export';
import { usePendingApprovals, useApproveEntry, useRejectEntry } from '@/lib/hooks/use-approvals';
import { useProjects } from '@/lib/hooks/use-projects';
import { useCompanyRevenueEntries } from '@/lib/hooks/use-revenue-entries';
import { useCompanyProjectFixedCosts } from '@/lib/hooks/use-project-fixed-costs';
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
  type RangePreset,
} from '@/lib/reports';
import { ApprovalRow } from '@/components/approvals/ApprovalRow';
import { ProjectPnLCard } from '@/components/reports/ProjectPnLCard';
import { TrendsCard } from '@/components/reports/TrendsCard';
import { TagBreakdown } from '@/components/reports/TagBreakdown';
import { FreelancerBreakdown } from '@/components/reports/FreelancerBreakdown';
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

  // Company-scoped P&L inputs fetched ONCE, then sliced per project below —
  // avoids the 3-query-per-card fan-out (N+1) the cards used to trigger.
  const { data: revenueEntries } = useCompanyRevenueEntries(companyId ?? undefined);
  const { data: referralEarnings } = useReferralEarnings(companyId ? { companyId } : {});
  const { data: invoices } = useInvoices({ companyId: companyId ?? '' });
  const { data: fixedCosts } = useCompanyProjectFixedCosts(companyId ?? undefined);

  // Approved billable time in-range — one company-scoped query, sliced per user.
  const { data: approvedEntries, isLoading: loadingApproved } = useTimeEntries({
    companyId: companyId ?? '',
    status: 'approved',
    billable: true,
    from: range.from,
    to: range.to,
  });
  const { data: members, isLoading: loadingMembers } = useCompanyMembers(companyId ?? undefined);

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

  const freelancerRows = useMemo(() => {
    const invoicesInRange = (invoices ?? []).filter((inv) => inRange(inv.period_month, range));
    return summarizeFreelancers(approvedEntries ?? [], invoicesInRange);
  }, [approvedEntries, invoices, range]);

  // Six-month revenue/cost/margin trend — independent of the range preset above,
  // built from the company-wide data already fetched (no extra queries).
  const trend = useMemo(
    () => monthlyTrend(revenueEntries ?? [], referralEarnings ?? [], invoices ?? [], fixedCosts ?? [], todayISO(), 6),
    [revenueEntries, referralEarnings, invoices, fixedCosts],
  );

  const pendingList = pending ?? [];
  const projectList = projects ?? [];
  const breakdownLoading =
    (loadingApproved && approvedEntries == null) || (loadingMembers && members == null);

  const busy = approve.isPending || reject.isPending;
  const allSelected = pendingList.length > 0 && selected.size === pendingList.length;

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
    <StackScreen title={t('tabs.nav.reports')}>
      <View style={styles.wrap}>
        <View style={styles.section}>
          <SectionHeader eyebrow={t('tabs.reports.scope')} title={t('tabs.reports.dateRange')} />
          <Segmented options={RANGE_OPTIONS} value={preset} onValueChange={(v) => setPreset(v as RangePreset)} />
          <View style={styles.exportRow}>
            <Button
              title={t('tabs.reports.exportTime')}
              size="sm"
              variant="secondary"
              onPress={() => void exportCsv(`chrono-time-${range.from ?? 'all'}.csv`, timeEntriesCsv(approvedEntries ?? []))}
            />
            <Button
              title={t('tabs.reports.exportInvoices')}
              size="sm"
              variant="secondary"
              onPress={() => void exportCsv('chrono-invoices.csv', invoicesCsv(invoices ?? []))}
            />
            <Button title={t('tabs.reports.auditLog')} size="sm" variant="ghost" onPress={() => router.push('/audit')} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader
            eyebrow={t('tabs.reports.review')}
            title={t('tabs.home.pendingApprovals')}
            count={pendingList.length}
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
          ) : pendingList.length === 0 ? (
            <EmptyState
              icon="checkmark-done-outline"
              title={t('tabs.reports.allCaughtUp')}
              subtitle={t('tabs.reports.allCaughtUpSubtitle')}
              tone="success"
            />
          ) : (
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
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader eyebrow={t('tabs.reports.trends')} title={t('tabs.reports.last6Months')} />
          <TrendsCard points={trend} currency={currency} />
        </View>

        <View style={styles.section}>
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

        <View style={styles.section}>
          <SectionHeader eyebrow={t('tabs.reports.categories')} title={t('tabs.reports.byTag')} />
          {breakdownLoading ? <ScreenLoader /> : <TagBreakdown entries={approvedEntries ?? []} />}
        </View>

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
  bulkActions: { flexDirection: 'row', gap: spacing.sm, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
  exportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
