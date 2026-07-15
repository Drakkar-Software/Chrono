import { ListItem, Money } from '@chrono/ui';
import type { ProjectFixedCost } from '@chrono/sdk';
import { useT } from '@/lib/i18n';
import { RowRemoveTrailing } from './RowRemoveTrailing';

export interface FixedCostRowProps {
  cost: ProjectFixedCost;
  currency: string;
  onPress?: () => void;
  /** Manager-only: remove this fixed cost. Renders a trailing remove control. */
  onRemove?: () => void;
  removing?: boolean;
}

/** One fixed cost: name + cadence on the left, its amount on the right. */
export function FixedCostRow({ cost, currency, onPress, onRemove, removing }: FixedCostRowProps) {
  const t = useT();
  const subtitle = cost.cadence === 'recurring' ? t('comp.fixedcost.monthly') : t('comp.fixedcost.oneOff');
  const money = <Money cents={cost.amount_cents} currency={currency} />;

  return (
    <ListItem
      title={cost.name}
      subtitle={subtitle}
      onPress={onPress}
      trailing={
        onRemove ? (
          <RowRemoveTrailing onRemove={onRemove} removing={removing} label={cost.name}>
            {money}
          </RowRemoveTrailing>
        ) : (
          money
        )
      }
    />
  );
}
