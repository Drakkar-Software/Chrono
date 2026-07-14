import { ListItem, Money } from '@chrono/ui';
import {
  monthlyRecurringAmount,
  revenueSourceLabel,
  sourceClientTjm,
} from '@chrono/sdk';
import type { RevenueSource } from '@chrono/sdk';

export interface RevenueSourceRowProps {
  source: RevenueSource;
  currency: string;
  onPress?: () => void;
}

/** One revenue source: name + type on the left, its headline amount on the right. */
export function RevenueSourceRow({ source, currency, onPress }: RevenueSourceRowProps) {
  const isRecurring = source.type === 'recurring';
  const amount = isRecurring ? monthlyRecurringAmount(source) : sourceClientTjm(source);
  const subtitle = isRecurring
    ? `${revenueSourceLabel(source.type)} · monthly`
    : `${revenueSourceLabel(source.type)} · client TJM`;

  return (
    <ListItem
      title={source.name}
      subtitle={subtitle}
      onPress={onPress}
      trailing={<Money cents={amount} currency={currency} />}
    />
  );
}
