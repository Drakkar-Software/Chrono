import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, CardGrid, EmptyState, Money, Row, StackScreen, Txt, spacing } from '@chrono/ui';
import { canManage, companyCurrency } from '@chrono/sdk';
import type { InvoiceWithRelations } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useInvoices } from '@/lib/hooks/use-invoices';
import { useGenerateInvoice, useSettleProjectMonth, useSubmitInvoice } from '@/lib/hooks/use-invoice-mutations';
import { useMyProjects, useProjects } from '@/lib/hooks/use-projects';
import { useMyReferralEarnings } from '@/lib/hooks/use-referral-earnings';
import { InvoiceCard } from '@/components/invoices/InvoiceCard';
import { GenerateInvoiceForm, type GenerateInvoiceParams } from '@/components/invoices/GenerateInvoiceForm';
import { SettleMonthForm } from '@/components/invoices/SettleMonthForm';
import { usePagination } from '@/lib/hooks/use-pagination';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState, InlineError } from '@/components/common/ErrorState';
import { LoadMore } from '@/components/common/LoadMore';

function groupByMonth(invoices: InvoiceWithRelations[]) {
  const out: Record<string, InvoiceWithRelations[]> = {};
  for (const inv of invoices) {
    const key = inv.period_month.slice(0, 7);
    (out[key] ??= []).push(inv);
  }
  return Object.keys(out)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((month) => ({ month, items: out[month] }));
}

export default function InvoicesScreen() {
  const t = useT();
  const router = useRouter();
  const { user } = useAppAuth();
  const { companyId, company, role } = useActiveCompany();
  const manager = canManage(role);
  const currency = companyCurrency(company);
  const userId = user?.id;

  const {
    data: invoices,
    isLoading,
    error: invoicesError,
    refetch: refetchInvoices,
  } = useInvoices({
    companyId: companyId ?? '',
    freelancerId: manager ? undefined : userId,
  });
  const allInvoices = useMemo(() => invoices ?? [], [invoices]);
  const { page, hasMore, loadMore } = usePagination(
    allInvoices,
    `${companyId ?? ''}:${manager ? 'managed' : 'mine'}`,
  );
  const groups = useMemo(() => groupByMonth(page), [page]);

  const mine = useMyProjects(!manager ? userId : undefined, !manager ? companyId ?? undefined : undefined);
  const managed = useProjects(manager ? companyId ?? undefined : undefined);
  const { data: referralEarnings, refetch: refetchReferrals } = useMyReferralEarnings(
    !manager ? userId : undefined,
    companyId ?? undefined,
  );

  const generate = useGenerateInvoice();
  const submit = useSubmitInvoice();
  const settle = useSettleProjectMonth();
  const [panel, setPanel] = useState<'none' | 'generate' | 'settle'>('none');

  const onGenerate = async (params: GenerateInvoiceParams) => {
    if (!companyId || !userId) return;
    try {
      const invoice = await generate.mutateAsync({
        projectId: params.projectId,
        freelancerId: userId,
        companyId,
        month: params.month,
        tjmCents: params.tjmCents,
        hoursPerDay: params.hoursPerDay,
      });
      await submit.mutateAsync(invoice.id);
      await refetchInvoices();
      setPanel('none');
    } catch {
      // Keep the panel open and surface the error below the form.
    }
  };

  const onSettle = async (projectId: string, month: string) => {
    try {
      await settle.mutateAsync(projectId, month);
      await Promise.all([refetchInvoices(), refetchReferrals()]);
      setPanel('none');
    } catch {
      // Keep the panel open and surface the error below the form.
    }
  };

  const headerRight =
    panel === 'none' ? (
      <Button
        title={manager ? t('tabs.invoices.settle') : t('tabs.invoices.generate')}
        size="sm"
        onPress={() => setPanel(manager ? 'settle' : 'generate')}
      />
    ) : undefined;

  return (
    <StackScreen title={t('tabs.nav.invoices')} headerRight={headerRight}>
      <View style={styles.wrap}>
        {panel === 'generate' && userId ? (
          <>
            <GenerateInvoiceForm
              projects={mine.data ?? []}
              freelancerId={userId}
              onGenerate={onGenerate}
              onCancel={() => setPanel('none')}
              isSubmitting={generate.isPending || submit.isPending}
            />
            {generate.error || submit.error ? (
              <InlineError
                error={generate.error ?? submit.error}
                describe={{ duplicateMessage: t('tabs.invoices.duplicateMessage') }}
              />
            ) : null}
          </>
        ) : null}

        {panel === 'settle' ? (
          <>
            <SettleMonthForm
              projects={managed.data ?? []}
              onSettle={onSettle}
              onCancel={() => setPanel('none')}
              isSubmitting={settle.isPending}
            />
            {settle.error ? <InlineError error={settle.error} /> : null}
          </>
        ) : null}

        {isLoading && invoices == null && panel === 'none' ? (
          <ScreenLoader />
        ) : invoicesError && invoices == null && panel === 'none' ? (
          <ErrorState
            error={invoicesError}
            title={t('tabs.invoices.loadError')}
            onRetry={() => {
              void refetchInvoices();
            }}
          />
        ) : groups.length === 0 && panel === 'none' ? (
          <EmptyState
            icon="receipt-outline"
            title={t('tabs.invoices.empty')}
            subtitle={manager ? t('tabs.invoices.emptyManager') : t('tabs.invoices.emptyFreelancer')}
            action={!manager ? <Button title={t('tabs.invoices.generateInvoice')} onPress={() => setPanel('generate')} /> : undefined}
            tone="accent"
          />
        ) : (
          <>
            {groups.map((group) => (
              <View key={group.month} style={styles.group}>
                <SectionHeader title={group.month} count={group.items.length} />
                <CardGrid minColumnWidth={260}>
                  {group.items.map((invoice) => (
                    <InvoiceCard
                      key={invoice.id}
                      invoice={invoice}
                      currency={currency}
                      onPress={() => router.push(`/invoice/${invoice.id}`)}
                    />
                  ))}
                </CardGrid>
              </View>
            ))}
            <LoadMore
              hasMore={hasMore}
              onLoadMore={loadMore}
              remaining={allInvoices.length - page.length}
            />
          </>
        )}

        {!manager && (referralEarnings ?? []).length > 0 ? (
          <Card padding="lg" style={styles.referralCard}>
            <Txt variant="heading">{t('tabs.invoices.referralEarnings')}</Txt>
            {(referralEarnings ?? []).map((earning) => (
              <Row key={earning.id} label={earning.period_month.slice(0, 7)}>
                <Money cents={earning.amount_cents} currency={currency} />
              </Row>
            ))}
          </Card>
        ) : null}
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  group: { gap: spacing.sm },
  referralCard: { gap: spacing.sm },
});
