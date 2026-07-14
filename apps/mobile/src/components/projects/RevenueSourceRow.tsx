import { ListItem, Money } from '@chrono/ui';
import {
  monthlyRecurringAmount,
  revenueSourceLabel,
  sourceClientTjm,
} from '@chrono/sdk';
import type { RevenueSource } from '@chrono/sdk';
import { useT } from '@/lib/i18n';

export interface RevenueSourceRowProps {
  source: RevenueSource;
  currency: string;
  onPress?: () => void;
}

/** One revenue source: name + type on the left, its headline amount on the right. */
export function RevenueSourceRow({ source, currency, onPress }: RevenueSourceRowProps) {
  const t = useT();
  const isRecurring = source.type === 'recurring';
  const amount = isRecurring ? monthlyRecurringAmount(source) : sourceClientTjm(source);
  const subtitle = isRecurring
    ? `${revenueSourceLabel(source.type)} · ${t('comp.revsource.monthly')}`
    : `${revenueSourceLabel(source.type)} · ${t('comp.revsource.clientTjm')}`;

  return (
    <ListItem
      title={source.name}
      subtitle={subtitle}
      onPress={onPress}
      trailing={<Money cents={amount} currency={currency} />}
    />
  );
}
