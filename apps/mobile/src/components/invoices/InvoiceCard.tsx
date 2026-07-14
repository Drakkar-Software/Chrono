import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, Money, Txt, borders, radii, spacing, useTheme } from '@chrono/ui';
import { invoiceAmounts, invoiceStatusLabel } from '@chrono/sdk';
import type { InvoiceWithRelations } from '@chrono/sdk';
import { invoiceBadge } from '@/lib/status';

export interface InvoiceCardProps {
  invoice: InvoiceWithRelations;
  currency: string;
  onPress?: () => void;
}

/** Compact invoice summary: period + project, amount due, status. */
export function InvoiceCard({ invoice, currency, onPress }: InvoiceCardProps) {
  const { colors } = useTheme();
  const amounts = invoiceAmounts(invoice);
  const period = invoice.period_month.slice(0, 7);

  return (
    <Pressable
      onPress={onPress}
      disabled={onPress == null}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed && onPress ? colors.surfaceRaised : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.left}>
        <Txt variant="bodyMedium">{period}</Txt>
        {invoice.project?.name ? (
          <Txt variant="caption" tone="textMuted" numberOfLines={1}>
            {invoice.project.name}
          </Txt>
        ) : null}
      </View>
      <View style={styles.right}>
        <Money cents={amounts.amountDueCents} currency={currency} />
        <Badge label={invoiceStatusLabel(invoice.status)} status={invoiceBadge(invoice.status)} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    padding: spacing.lg,
  },
  left: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: spacing.xs },
});
