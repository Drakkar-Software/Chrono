import { StyleSheet, View } from 'react-native';
import { Badge, ListItem, Money, spacing } from '@chrono/ui';
import {
  netRevenueForSource,
  revenueSourceInactive,
  revenueSourceLabel,
  sourceHeadlineAmount,
  sourceManualAmount,
  sourceManualDays,
} from '@chrono/sdk';
import type { RevenueEntry, RevenueSource } from '@chrono/sdk';
import { useT } from '@/lib/i18n';
import { RowRemoveTrailing } from './RowRemoveTrailing';

export interface RevenueSourceRowProps {
  source: RevenueSource;
  currency: string;
  /** All non-deleted project revenue entries — used for net after corrections. */
  revenueEntries?: RevenueEntry[];
  onPress?: () => void;
  /** Manager-only: correct/deactivate this source (history kept). */
  onCorrect?: () => void;
  correcting?: boolean;
}

/** One revenue source: name + type on the left, net/headline amount on the right. */
export function RevenueSourceRow({
  source,
  currency,
  revenueEntries = [],
  onPress,
  onCorrect,
  correcting,
}: RevenueSourceRowProps) {
  const t = useT();
  const inactive = revenueSourceInactive(source);
  const hasEntries = revenueEntries.some((e) => e.revenue_source_id === source.id);
  const netCents = hasEntries ? netRevenueForSource(revenueEntries, source.id) : sourceHeadlineAmount(source);
  const isRecurring = source.type === 'recurring';
  const manualAmount = sourceManualAmount(source);
  const manualDays = sourceManualDays(source);
  const subtitle = isRecurring
    ? `${revenueSourceLabel(source.type)} · ${t('comp.revsource.monthly')}`
    : manualAmount != null
      ? `${revenueSourceLabel(source.type)} · ${t('comp.revsource.daysInvoicedSubtitle', { days: manualDays ?? 0 })}`
      : `${revenueSourceLabel(source.type)} · ${t('comp.revsource.clientTjm')}`;

  const money = (
    <Money
      cents={netCents}
      currency={currency}
      tone={netCents < 0 ? 'danger' : inactive ? 'textMuted' : 'text'}
    />
  );

  return (
    <ListItem
      title={source.name}
      subtitle={subtitle}
      onPress={onPress}
      trailing={
        <View style={styles.trailing}>
          {inactive ? (
            <Badge label={t('comp.revsource.correctedBadge')} status="warning" />
          ) : null}
          {onCorrect && !inactive ? (
            <RowRemoveTrailing
              onRemove={onCorrect}
              removing={correcting}
              label={source.name}
              actionLabel={t('comp.revsource.correct')}
            >
              {money}
            </RowRemoveTrailing>
          ) : (
            money
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
