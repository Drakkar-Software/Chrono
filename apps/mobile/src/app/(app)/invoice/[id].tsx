import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, Row, StackScreen, Txt, spacing } from '@chrono/ui';
import { canManage, companyCurrency, invoiceStatusLabel } from '@chrono/sdk';

import { useActiveCompany } from '@/lib/active-company-context';
import { useInvoice } from '@/lib/hooks/use-invoices';
import { useSettleProjectMonth, useSubmitInvoice } from '@/lib/hooks/use-invoice-mutations';
import { invoiceBadge } from '@/lib/status';
import { Loading } from '@/components/Loading';
import { AmountBreakdown } from '@/components/invoices/AmountBreakdown';

export default function InvoiceDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { company, role } = useActiveCompany();
  const manager = canManage(role);
  const currency = companyCurrency(company);

  const { data: invoice, isLoading } = useInvoice(id);
  const submit = useSubmitInvoice();
  const settle = useSettleProjectMonth();

  if (isLoading && !invoice) return <Loading />;
  if (!invoice) {
    return (
      <StackScreen title="Invoice" onBack={() => router.back()}>
        <Txt variant="body" tone="textMuted">
          Invoice not found.
        </Txt>
      </StackScreen>
    );
  }

  return (
    <StackScreen title={invoice.period_month.slice(0, 7)} onBack={() => router.back()}>
      <View style={styles.wrap}>
        <Card padding="lg" style={styles.card}>
          <View style={styles.header}>
            <Txt variant="heading" numberOfLines={1}>
              {invoice.project?.name ?? 'Invoice'}
            </Txt>
            <Badge label={invoiceStatusLabel(invoice.status)} status={invoiceBadge(invoice.status)} />
          </View>
          <Row label="Period" value={invoice.period_month.slice(0, 7)} />
          <AmountBreakdown invoice={invoice} currency={currency} />
        </Card>

        {invoice.status === 'draft' ? (
          <Button
            title="Submit invoice"
            onPress={() => submit.mutate(invoice.id)}
            loading={submit.isPending}
            fullWidth
          />
        ) : null}

        {manager ? (
          <Button
            title="Settle project month"
            variant="secondary"
            onPress={() => settle.mutate(invoice.project_id, invoice.period_month)}
            loading={settle.isPending}
            fullWidth
          />
        ) : null}
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
});
