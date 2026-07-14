import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, Money, Row, StackScreen, spacing, useResponsive } from '@chrono/ui';
import {
  canManage,
  companyCurrency,
  companyLegal,
  freelancerLegal,
  invoiceAmounts,
  invoiceLabel,
} from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { useAppAuth } from '@/lib/supabase-stores';
import { useInvoice } from '@/lib/hooks/use-invoices';
import { useProfile, useProfileBilling } from '@/lib/hooks/use-profile';
import { useSettleProjectMonth, useSubmitInvoice } from '@/lib/hooks/use-invoice-mutations';
import { buildInvoiceHtml, exportInvoice } from '@/lib/invoice-document';
import { invoiceBadge } from '@/lib/status';
import { AmountBreakdown } from '@/components/invoices/AmountBreakdown';
import { PaymentsSection } from '@/components/invoices/PaymentsSection';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState, InlineError } from '@/components/common/ErrorState';
import { StatRow, StatTile } from '@/components/ui/StatTile';

export default function InvoiceDetail() {
  const t = useT();
  const router = useRouter();
  const { isWide } = useResponsive();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { company, role } = useActiveCompany();
  const { user } = useAppAuth();
  const manager = canManage(role);
  const currency = companyCurrency(company);

  const { data: invoice, isLoading, error, refetch } = useInvoice(id);
  // The issuing freelancer's name comes from their public profile; the private
  // legal details (address / VAT / business id) come from profile_billing, which
  // RLS returns only to the freelancer themselves and to their managers.
  const { data: freelancerProfile } = useProfile(invoice?.freelancer_id);
  const { data: freelancerBilling } = useProfileBilling(invoice?.freelancer_id);
  const submit = useSubmitInvoice();
  const settle = useSettleProjectMonth();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | undefined>();

  // The invoice's own freelancer can export it; managers can export any.
  const canExport = manager || invoice?.freelancer_id === user?.id;

  const onExport = async () => {
    if (!invoice) return;
    setExportError(undefined);
    setExporting(true);
    try {
      const legal = companyLegal(company);
      const freelancer = freelancerLegal(freelancerProfile, freelancerBilling);
      const logoUrl = (company?.content as { logo_url?: string } | null)?.logo_url ?? null;
      const html = buildInvoiceHtml({
        invoice,
        projectName: invoice.project?.name ?? 'Project',
        from: {
          name: freelancer.name,
          address: freelancer.address,
          vatId: freelancer.vatId,
          registrationId: freelancer.businessId,
        },
        to: {
          name: legal.name,
          address: legal.address,
          vatId: legal.vatId,
          registrationId: legal.registrationId,
        },
        currency,
        logoUrl,
      });
      await exportInvoice(html);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t('details.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

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
      <StackScreen title={t('details.invoice')} onBack={() => router.back()}>
        <ScreenLoader />
      </StackScreen>
    );
  }
  if (error && !invoice) {
    return (
      <StackScreen title={t('details.invoice')} onBack={() => router.back()}>
        <ErrorState
          error={error}
          title={t('details.invoiceLoadError')}
          onRetry={() => {
            void refetch();
          }}
        />
      </StackScreen>
    );
  }
  if (!invoice) {
    return (
      <StackScreen title={t('details.invoice')} onBack={() => router.back()}>
        <EmptyState
          icon="receipt-outline"
          title={t('details.invoiceNotFound')}
          subtitle={t('details.mayHaveBeenRemoved')}
        />
      </StackScreen>
    );
  }

  const a = invoiceAmounts(invoice);

  return (
    <StackScreen title={invoiceLabel(invoice)} onBack={() => router.back()}>
      <View style={styles.wrap}>
        <Card padding="lg" style={styles.card}>
          <View style={styles.header}>
            <SectionHeader
              title={invoice.project?.name ?? t('details.invoice')}
              action={<Badge label={t('status.' + invoice.status)} status={invoiceBadge(invoice.status)} />}
            />
          </View>
          <StatRow>
            <StatTile label={t('details.earned')}>
              <Money cents={a.earnedCents} currency={currency} variant="heading" />
            </StatTile>
            <StatTile label={t('details.paid')}>
              <Money cents={a.amountPaidCents} currency={currency} variant="heading" tone="success" />
            </StatTile>
            <StatTile label={t('details.carriedForward')}>
              <Money cents={a.creditCarriedForwardCents} currency={currency} variant="heading" tone="textMuted" />
            </StatTile>
          </StatRow>
          {invoice.invoice_number ? <Row label={t('details.invoiceNumber')} value={invoice.invoice_number} /> : null}
          <Row label={t('common.period')} value={invoice.period_month.slice(0, 7)} />
          {invoice.issued_on ? <Row label={t('details.issued')} value={invoice.issued_on} /> : null}
          <AmountBreakdown invoice={invoice} currency={currency} />
        </Card>

        <View style={[styles.actions, isWide && styles.actionsWide]}>
          {invoice.status === 'draft' ? (
            <Button
              title={t('details.submitInvoice')}
              onPress={onSubmit}
              loading={submit.isPending}
              fullWidth={!isWide}
            />
          ) : null}

          {manager ? (
            <Button
              title={t('details.settleProjectMonth')}
              variant="secondary"
              onPress={onSettle}
              loading={settle.isPending}
              fullWidth={!isWide}
            />
          ) : null}

          {canExport ? (
            <Button
              title={t('details.exportShare')}
              variant="secondary"
              onPress={onExport}
              loading={exporting}
              fullWidth={!isWide}
            />
          ) : null}
        </View>

        {submit.error ? <InlineError error={submit.error} /> : null}
        {settle.error ? <InlineError error={settle.error} /> : null}
        {exportError ? <InlineError error={exportError} /> : null}

        <PaymentsSection
          invoiceId={invoice.id}
          companyId={invoice.company_id}
          currency={currency}
          canManage={manager}
          userId={user?.id}
        />
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
