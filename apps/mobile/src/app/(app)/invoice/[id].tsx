import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, Money, Row, StackScreen, spacing, useResponsive } from '@chrono/ui';
import { canManage, companyCurrency, invoiceAmounts, invoiceStatusLabel } from '@chrono/sdk';

import { useActiveCompany } from '@/lib/active-company-context';
import { useInvoice } from '@/lib/hooks/use-invoices';
import { useSettleProjectMonth, useSubmitInvoice } from '@/lib/hooks/use-invoice-mutations';
import { invoiceBadge } from '@/lib/status';
import { AmountBreakdown } from '@/components/invoices/AmountBreakdown';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState, InlineError } from '@/components/common/ErrorState';
import { StatRow, StatTile } from '@/components/ui/StatTile';

export default function InvoiceDetail() {
  const router = useRouter();
  const { isWide } = useResponsive();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { company, role } = useActiveCompany();
  const manager = canManage(role);
  const currency = companyCurrency(company);

  const { data: invoice, isLoading, error, refetch } = useInvoice(id);
  const submit = useSubmitInvoice();
  const settle = useSettleProjectMonth();

  const onSubmit = async () => {
    if (!invoice) return;
    try {
      await submit.mutateAsync(invoice.id);
      await refetch();
    } catch {
      // Surfaced via `submit.error` below.
    }
  };

  const onSettle = async () => {
    if (!invoice) return;
    try {
      await settle.mutateAsync(invoice.project_id, invoice.period_month);
      await refetch();
    } catch {
      // Surfaced via `settle.error` below.
    }
  };

  if (isLoading && !invoice) {
    return (
      <StackScreen title="Invoice" onBack={() => router.back()}>
        <ScreenLoader />
      </StackScreen>
    );
  }
  if (error && !invoice) {
    return (
      <StackScreen title="Invoice" onBack={() => router.back()}>
        <ErrorState
          error={error}
          title="Couldn't load invoice"
          onRetry={() => {
            void refetch();
          }}
        />
      </StackScreen>
    );
  }
  if (!invoice) {
    return (
      <StackScreen title="Invoice" onBack={() => router.back()}>
        <EmptyState icon="receipt-outline" title="Invoice not found" subtitle="It may have been removed." />
      </StackScreen>
    );
  }

  const a = invoiceAmounts(invoice);

  return (
    <StackScreen title={invoice.period_month.slice(0, 7)} onBack={() => router.back()}>
      <View style={styles.wrap}>
        <Card padding="lg" style={styles.card}>
          <View style={styles.header}>
            <SectionHeader
              title={invoice.project?.name ?? 'Invoice'}
              action={<Badge label={invoiceStatusLabel(invoice.status)} status={invoiceBadge(invoice.status)} />}
            />
          </View>
          <StatRow>
            <StatTile label="Earned">
              <Money cents={a.earnedCents} currency={currency} variant="heading" />
            </StatTile>
            <StatTile label="Paid">
              <Money cents={a.amountPaidCents} currency={currency} variant="heading" tone="success" />
            </StatTile>
            <StatTile label="Carried fwd">
              <Money cents={a.creditCarriedForwardCents} currency={currency} variant="heading" tone="textMuted" />
            </StatTile>
          </StatRow>
          <Row label="Period" value={invoice.period_month.slice(0, 7)} />
          <AmountBreakdown invoice={invoice} currency={currency} />
        </Card>

        <View style={[styles.actions, isWide && styles.actionsWide]}>
          {invoice.status === 'draft' ? (
            <Button
              title="Submit invoice"
              onPress={onSubmit}
              loading={submit.isPending}
              fullWidth={!isWide}
            />
          ) : null}

          {manager ? (
            <Button
              title="Settle project month"
              variant="secondary"
              onPress={onSettle}
              loading={settle.isPending}
              fullWidth={!isWide}
            />
          ) : null}
        </View>

        {submit.error ? <InlineError error={submit.error} /> : null}
        {settle.error ? <InlineError error={settle.error} /> : null}
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  card: { gap: spacing.md },
  header: { marginBottom: spacing.xs },
  actions: { gap: spacing.sm },
  actionsWide: { flexDirection: 'row', flexWrap: 'wrap' },
});
