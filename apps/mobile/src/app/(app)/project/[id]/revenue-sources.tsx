import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, EmptyState, IconButton, Money, Row, StackScreen, Txt, spacing } from '@chrono/ui';
import {
  canManage,
  companyCurrency,
  dueRevenue,
  fetchRevenueForMonth,
  markRevenueEntriesPaid,
  revenueEntryPaid,
} from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { todayISO } from '@/lib/date';
import { globalSupabaseClient } from '@/lib/supabase';
import { useProject } from '@/lib/hooks/use-projects';
import { useRevenueSources, useRevenueSourceMutations } from '@/lib/hooks/use-revenue-sources';
import { useMarkRevenueEntriesPaid, useRecognizeRevenue, useRevenueEntries } from '@/lib/hooks/use-revenue-entries';
import { RevenueSourceRow } from '@/components/projects/RevenueSourceRow';
import { AddRevenueSourceForm, type AddRevenueSourceValues } from '@/components/projects/AddRevenueSourceForm';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState, InlineError } from '@/components/common/ErrorState';

export default function ProjectRevenueSourcesScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { company, role } = useActiveCompany();
  const manager = canManage(role);
  const currency = companyCurrency(company);

  const { data: project } = useProject(id);
  const { data: sources, isLoading, error, refetch } = useRevenueSources(id);
  const { data: revenueEntries } = useRevenueEntries(id);
  const sourceMut = useRevenueSourceMutations();
  const { mutateAsync: recognizeRevenue, isPending: recognizing } = useRecognizeRevenue();
  const { mutateAsync: markPaid, isPending: markingPaid } = useMarkRevenueEntriesPaid();
  const [adding, setAdding] = useState(false);

  const dueEntries = useMemo(() => (revenueEntries ?? []).filter((e) => !revenueEntryPaid(e)), [revenueEntries]);
  const dueCents = useMemo(() => dueRevenue(revenueEntries ?? []), [revenueEntries]);

  const markAllPaid = () => void markPaid(dueEntries.map((e) => e.id), true);

  const addSource = async (values: AddRevenueSourceValues) => {
    if (!project) return;
    const created = await sourceMut.create({
      project_id: project.id,
      company_id: project.company_id,
      type: values.type,
      name: values.name,
      content: values.content,
      external_invoice_id: values.externalInvoiceId ?? null,
    });
    const today = todayISO();
    // Recognize the current month immediately so the funding pool (available
    // balance) reflects the new source right away, instead of only at the
    // next invoice settle.
    await recognizeRevenue(project.id, today);
    if (values.markPaid) {
      // Find the entry recognition just created for this source and flag it
      // paid right away (the manager is logging money already received).
      const entries = await fetchRevenueForMonth(globalSupabaseClient, project.id, today);
      const entry = entries.find((e) => e.revenue_source_id === created.id);
      if (entry) {
        await markRevenueEntriesPaid(globalSupabaseClient, [entry.id], true);
      }
    }
    setAdding(false);
  };
  const removeSource = async (sourceId: string) => {
    if (!project) return;
    await sourceMut.deactivate(sourceId);
    // A deactivated/removed source's revenue must be retired from the pool
    // right away too — recognize_project_revenue does that retirement.
    await recognizeRevenue(project.id, todayISO());
  };

  if (!manager) {
    return (
      <StackScreen title={t('details.revenueSources')} onBack={() => router.back()}>
        <EmptyState icon="lock-closed-outline" title={t('common.managersOnly')} />
      </StackScreen>
    );
  }

  return (
    <StackScreen
      title={t('details.revenueSources')}
      onBack={() => router.back()}
      headerRight={!adding ? <IconButton name="add" onPress={() => setAdding(true)} accessibilityLabel={t('common.add')} /> : undefined}
    >
      <View style={{ gap: spacing.md }}>
        {adding ? (
          <>
            <AddRevenueSourceForm
              onAdd={addSource}
              onCancel={() => setAdding(false)}
              isSubmitting={sourceMut.isPending || recognizing}
              defaultTjmCents={project?.default_tjm_cents}
            />
            {sourceMut.error ? <InlineError error={sourceMut.error} /> : null}
          </>
        ) : null}

        {(sources ?? []).length > 0 && !adding ? (
          dueCents > 0 ? (
            <Card padding="md" style={{ gap: spacing.sm }}>
              <Row label={t('details.dueByClient')}>
                <Money cents={dueCents} currency={currency} tone="warning" />
              </Row>
              <Button
                title={t('details.markAllPaid')}
                size="sm"
                variant="secondary"
                onPress={markAllPaid}
                loading={markingPaid}
              />
            </Card>
          ) : (
            <Txt variant="caption" tone="textMuted">
              {t('details.allPaidUpToDate')}
            </Txt>
          )
        ) : null}

        {isLoading && !sources ? (
          <ScreenLoader />
        ) : error && !sources ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (sources ?? []).length === 0 && !adding ? (
          <EmptyState icon="cash-outline" title={t('details.noRevenueSources')} tone="accent" />
        ) : (
          <View>
            {(sources ?? []).map((source) => (
              <RevenueSourceRow
                key={source.id}
                source={source}
                currency={currency}
                onRemove={() => void removeSource(source.id)}
                removing={sourceMut.isPending || recognizing}
              />
            ))}
          </View>
        )}
      </View>
    </StackScreen>
  );
}
