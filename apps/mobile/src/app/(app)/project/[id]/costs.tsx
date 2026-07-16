import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState, IconButton, Segmented, StackScreen, spacing } from '@chrono/ui';
import { canManage, companyCurrency } from '@chrono/sdk';
import type { ProjectCostKind } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { uploadImage } from '@/lib/image-upload';
import { useProject } from '@/lib/hooks/use-projects';
import { useProjectMembers } from '@/lib/hooks/use-project-members';
import { useCompanyMembers } from '@/lib/hooks/use-company-members';
import {
  useMarkProjectCostsPaid,
  useProjectCostMutations,
  useProjectCosts,
} from '@/lib/hooks/use-project-costs';
import { AddCostForm, type AddCostValues } from '@/components/costs/AddCostForm';
import { CostRow } from '@/components/costs/CostRow';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState, InlineError } from '@/components/common/ErrorState';

type Filter = 'all' | ProjectCostKind;

export default function ProjectCostsScreen() {
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
  const { data: costs, isLoading, error, refetch } = useProjectCosts(id, companyId);
  const costMut = useProjectCostMutations();
  const markPaid = useMarkProjectCostsPaid();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const isProjectMember = (members ?? []).some((m) => m.user_id === user?.id);
  const canView = manager || isProjectMember;

  const profileByUserId = useMemo(() => {
    const map = new Map<string, { full_name: string | null }>();
    for (const m of companyMembers ?? []) {
      if (m.profile) map.set(m.user_id, m.profile);
    }
    return map;
  }, [companyMembers]);

  // A non-manager only ever receives reimbursables (RLS hides overhead), so
  // offering them the pool filters would just show empty tabs.
  const filterOptions = manager
    ? [
        { label: t('comp.cost.filterAll'), value: 'all' },
        { label: t('comp.cost.kindRecurring'), value: 'recurring' },
        { label: t('comp.cost.kindOneOff'), value: 'one_off' },
        { label: t('comp.cost.kindReimbursable'), value: 'reimbursable' },
      ]
    : [];

  const visible = useMemo(
    () => (costs ?? []).filter((c) => filter === 'all' || c.kind === filter),
    [costs, filter],
  );

  const addCost = async (values: AddCostValues) => {
    if (!project || !companyId || !user) return;
    const created = await costMut.create({
      project_id: project.id,
      company_id: companyId,
      kind: values.kind,
      label: values.label,
      amount_cents: values.amountCents,
      period_month: values.periodMonth ?? null,
      starts_on: values.startsOn ?? null,
      ends_on: values.endsOn ?? null,
      auto_deduct: values.autoDeduct ?? false,
      // Reimbursables carry the submitter + pending status the RLS insert
      // policy requires; pool costs must leave those null.
      user_id: values.kind === 'reimbursable' ? user.id : null,
      status: values.kind === 'reimbursable' ? 'pending' : null,
      spent_on: values.spentOn ?? null,
      category: values.category ?? null,
      created_by: user.id,
    });

    // paid_at goes through the RPC (manager-only), not the insert.
    if (values.paid) {
      await markPaid.mutateAsync([created.id], true);
    }

    if (values.receipt) {
      const path = `${companyId}/${created.id}.${values.receipt.ext}`;
      const url = await uploadImage('receipts', path, values.receipt.uri, values.receipt.contentType);
      await costMut.update(created.id, { receipt_url: url });
    }
    setAdding(false);
  };

  if (!canView) {
    return (
      <StackScreen title={t('details.costs')} onBack={() => router.back()}>
        <EmptyState icon="lock-closed-outline" title={t('common.notAllowed')} />
      </StackScreen>
    );
  }

  return (
    <StackScreen
      title={t('details.costs')}
      onBack={() => router.back()}
      headerRight={
        !adding ? (
          <IconButton name="add" onPress={() => setAdding(true)} accessibilityLabel={t('common.add')} />
        ) : undefined
      }
    >
      <View style={{ gap: spacing.md }}>
        {adding ? (
          <>
            <AddCostForm
              onAdd={addCost}
              onCancel={() => setAdding(false)}
              isSubmitting={costMut.isPending || markPaid.isPending}
              reimbursableOnly={!manager}
            />
            {costMut.error ? <InlineError error={costMut.error} /> : null}
            {markPaid.error ? <InlineError error={markPaid.error} /> : null}
          </>
        ) : null}

        {manager && !adding ? (
          <Segmented
            options={filterOptions}
            value={filter}
            onValueChange={(v) => setFilter(v as Filter)}
          />
        ) : null}

        {isLoading && !costs ? (
          <ScreenLoader />
        ) : error && !costs ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : visible.length === 0 && !adding ? (
          <EmptyState icon="receipt-outline" title={t('details.noCosts')} tone="accent" />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {visible.map((cost) => (
              <CostRow
                key={cost.id}
                cost={cost}
                currency={currency}
                submitter={cost.user_id ? profileByUserId.get(cost.user_id) : null}
                canManage={manager}
                onApprove={() => void costMut.approve(cost.id)}
                onReject={(reason) => void costMut.reject(cost.id, reason)}
                onMarkReimbursed={() => user && void costMut.markReimbursed(cost.id, user.id)}
                onTogglePaid={(paid) => void markPaid.mutateAsync([cost.id], paid)}
                onToggleActive={(active) => void costMut.update(cost.id, { active })}
                onRemove={() => void costMut.remove(cost.id)}
                isBusy={costMut.isPending || markPaid.isPending}
              />
            ))}
          </View>
        )}
      </View>
    </StackScreen>
  );
}
