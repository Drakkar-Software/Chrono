import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Button, Card, CardGrid, EmptyState, StackScreen, borders, spacing, useTheme } from '@chrono/ui';
import { canManage, companyCurrency } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { usePendingApprovals, useApproveEntry, useRejectEntry } from '@/lib/hooks/use-approvals';
import { usePendingExpenses, useExpenseMutations } from '@/lib/hooks/use-project-expenses';
import { useCompanyMembers } from '@/lib/hooks/use-company-members';
import { ApprovalRow } from '@/components/approvals/ApprovalRow';
import { ExpenseRow } from '@/components/expenses/ExpenseRow';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';

export default function ApprovalsScreen() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { companyId, company, role } = useActiveCompany();
  const currency = companyCurrency(company);

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
  const approve = useApproveEntry();
  const reject = useRejectEntry();

  const { data: pendingExpenses, refetch: refetchPendingExpenses } = usePendingExpenses(companyId ?? undefined);
  const expenseMut = useExpenseMutations();

  const { data: members } = useCompanyMembers(companyId ?? undefined);

  const pendingList = pending ?? [];
  const pendingExpenseList = pendingExpenses ?? [];
  const reviewCount = pendingList.length + pendingExpenseList.length;

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

  // Manager/admin only. Guard the direct-URL case — all hooks above run so
  // hook order stays stable.
  if (!canManage(role)) return <Redirect href="/(app)/(tabs)/home" />;

  return (
    <StackScreen title={t('tabs.reports.approvals')} onBack={() => router.back()}>
      <View style={styles.wrap}>
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
        ) : (
          <EmptyState
            icon="checkmark-circle-outline"
            title={t('tabs.reports.allCaughtUp')}
            subtitle={t('tabs.reports.allCaughtUpSubtitle')}
          />
        )}
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  queueCard: { gap: spacing.md, borderWidth: borders.thick },
  bulkActions: { flexDirection: 'row', gap: spacing.sm, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
});
