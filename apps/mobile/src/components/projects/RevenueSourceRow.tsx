import { ListItem, Money } from '@chrono/ui';
import {
  monthlyRecurringAmount,
  revenueSourceLabel,
  sourceClientTjm,
  sourceManualAmount,
  sourceManualDays,
} from '@chrono/sdk';
import type { RevenueSource } from '@chrono/sdk';
import { useT } from '@/lib/i18n';
import { RowRemoveTrailing } from './RowRemoveTrailing';

export interface RevenueSourceRowProps {
  source: RevenueSource;
  currency: string;
  onPress?: () => void;
  /** Manager-only: deactivate this source. Renders a trailing remove control. */
  onRemove?: () => void;
  removing?: boolean;
}

/** One revenue source: name + type on the left, its headline amount on the right. */
export function RevenueSourceRow({ source, currency, onPress, onRemove, removing }: RevenueSourceRowProps) {
  const t = useT();
  const isRecurring = source.type === 'recurring';
  const manualAmount = sourceManualAmount(source);
  const manualDays = sourceManualDays(source);
  const amount = isRecurring ? monthlyRecurringAmount(source) : manualAmount ?? sourceClientTjm(source);
  const subtitle = isRecurring
    ? `${revenueSourceLabel(source.type)} · ${t('comp.revsource.monthly')}`
    : manualAmount != null
      ? `${revenueSourceLabel(source.type)} · ${t('comp.revsource.daysInvoicedSubtitle', { days: manualDays ?? 0 })}`
      : `${revenueSourceLabel(source.type)} · ${t('comp.revsource.clientTjm')}`;
  const money = <Money cents={amount} currency={currency} />;

  return (
    <ListItem
      title={source.name}
      subtitle={subtitle}
      onPress={onPress}
      trailing={
        onRemove ? (
          <RowRemoveTrailing onRemove={onRemove} removing={removing} label={source.name}>
            {money}
          </RowRemoveTrailing>
        ) : (
          money
        )
      }
    />
  );
}
