import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState, IconButton, StackScreen, spacing } from '@chrono/ui';
import { canManage, companyCurrency } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { uploadImage } from '@/lib/image-upload';
import { useProject } from '@/lib/hooks/use-projects';
import { useProjectMembers } from '@/lib/hooks/use-project-members';
import { useCompanyMembers } from '@/lib/hooks/use-company-members';
import { useProjectExpenses, useExpenseMutations } from '@/lib/hooks/use-project-expenses';
import { AddExpenseForm, type AddExpenseValues } from '@/components/expenses/AddExpenseForm';
import { ExpenseRow } from '@/components/expenses/ExpenseRow';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState, InlineError } from '@/components/common/ErrorState';

export default function ProjectExpensesScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAppAuth();
  const { company, role } = useActiveCompany();
  const manager = canManage(role);
  const currency = companyCurrency(company);

  const { data: project } = useProject(id);
  const companyId = project?.company_id;
  const { data: members } = useProjectMembers(id);
  const { data: companyMembers } = useCompanyMembers(companyId);
  const { data: expenses, isLoading, error, refetch } = useProjectExpenses(id, companyId);
  const expenseMut = useExpenseMutations();
  const [adding, setAdding] = useState(false);

  const isProjectMember = (members ?? []).some((m) => m.user_id === user?.id);
  const canView = manager || isProjectMember;

  const profileByUserId = useMemo(() => {
    const map = new Map<string, { full_name: string | null }>();
    for (const m of companyMembers ?? []) {
      if (m.profile) map.set(m.user_id, m.profile);
    }
    return map;
  }, [companyMembers]);

  const addExpense = async (values: AddExpenseValues) => {
    if (!companyId || !user || !project) return;
    const created = await expenseMut.create({
      project_id: project.id,
      company_id: companyId,
      user_id: user.id,
      description: values.description,
      amount_cents: values.amountCents,
      spent_on: values.spentOn,
      category: values.category ?? null,
    });
    if (values.receipt) {
      const path = `${companyId}/${created.id}.${values.receipt.ext}`;
      const url = await uploadImage('receipts', path, values.receipt.uri, values.receipt.contentType);
      await expenseMut.update(created.id, { receipt_url: url });
    }
    setAdding(false);
  };

  if (!canView) {
    return (
      <StackScreen title={t('details.expenses')} onBack={() => router.back()}>
        <EmptyState icon="lock-closed-outline" title={t('common.notAllowed')} />
      </StackScreen>
    );
  }

  return (
    <StackScreen
      title={t('details.expenses')}
      onBack={() => router.back()}
      headerRight={!adding ? <IconButton name="add" onPress={() => setAdding(true)} accessibilityLabel={t('common.add')} /> : undefined}
    >
      <View style={{ gap: spacing.md }}>
        {adding ? (
          <>
            <AddExpenseForm
              onAdd={addExpense}
              onCancel={() => setAdding(false)}
              isSubmitting={expenseMut.isPending}
            />
            {expenseMut.error ? <InlineError error={expenseMut.error} /> : null}
          </>
        ) : null}

        {isLoading && !expenses ? (
          <ScreenLoader />
        ) : error && !expenses ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (expenses ?? []).length === 0 && !adding ? (
          <EmptyState icon="wallet-outline" title={t('details.noExpenses')} tone="accent" />
        ) : (
          <View>
            {(expenses ?? []).map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                currency={currency}
                submitter={profileByUserId.get(expense.user_id)}
                canModerate={manager}
                onApprove={() => void expenseMut.approve(expense.id)}
                onReject={(reason) => void expenseMut.reject(expense.id, reason)}
                onMarkReimbursed={() => user && void expenseMut.markReimbursed(expense.id, user.id)}
                isBusy={expenseMut.isPending}
              />
            ))}
          </View>
        )}
      </View>
    </StackScreen>
  );
}
