import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState, IconButton, StackScreen, spacing } from '@chrono/ui';
import { canManage, companyCurrency } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { useProject } from '@/lib/hooks/use-projects';
import { useProjectFixedCosts, useProjectFixedCostMutations } from '@/lib/hooks/use-project-fixed-costs';
import { FixedCostRow } from '@/components/projects/FixedCostRow';
import { AddFixedCostForm, type AddFixedCostValues } from '@/components/projects/AddFixedCostForm';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState, InlineError } from '@/components/common/ErrorState';

export default function ProjectFixedCostsScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { company, role } = useActiveCompany();
  const manager = canManage(role);
  const currency = companyCurrency(company);

  const { data: project } = useProject(id);
  const { data: fixedCosts, isLoading, error, refetch } = useProjectFixedCosts(id);
  const fixedCostMut = useProjectFixedCostMutations();
  const [adding, setAdding] = useState(false);

  const addFixedCost = async (values: AddFixedCostValues) => {
    if (!project) return;
    await fixedCostMut.create({
      project_id: project.id,
      company_id: project.company_id,
      name: values.name,
      cadence: values.cadence,
      amount_cents: values.amountCents,
      period_month: values.periodMonth ?? null,
      starts_on: values.startsOn ?? null,
    });
    setAdding(false);
  };

  if (!manager) {
    return (
      <StackScreen title={t('details.fixedCosts')} onBack={() => router.back()}>
        <EmptyState icon="lock-closed-outline" title={t('common.managersOnly')} />
      </StackScreen>
    );
  }

  return (
    <StackScreen
      title={t('details.fixedCosts')}
      onBack={() => router.back()}
      headerRight={!adding ? <IconButton name="add" onPress={() => setAdding(true)} accessibilityLabel={t('common.add')} /> : undefined}
    >
      <View style={{ gap: spacing.md }}>
        {adding ? (
          <>
            <AddFixedCostForm
              onAdd={addFixedCost}
              onCancel={() => setAdding(false)}
              isSubmitting={fixedCostMut.isPending}
            />
            {fixedCostMut.error ? <InlineError error={fixedCostMut.error} /> : null}
          </>
        ) : null}

        {isLoading && !fixedCosts ? (
          <ScreenLoader />
        ) : error && !fixedCosts ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (fixedCosts ?? []).length === 0 && !adding ? (
          <EmptyState icon="receipt-outline" title={t('details.noFixedCosts')} tone="accent" />
        ) : (
          <View>
            {(fixedCosts ?? []).map((cost) => (
              <FixedCostRow
                key={cost.id}
                cost={cost}
                currency={currency}
                onRemove={() => void fixedCostMut.remove(cost.id)}
                removing={fixedCostMut.isPending}
              />
            ))}
          </View>
        )}
      </View>
    </StackScreen>
  );
}
