import { ListItem, Txt } from '@chrono/ui';
import { displayName } from '@chrono/sdk';
import type { ProjectReferralWithProfile } from '@chrono/sdk';
import { useT } from '@/lib/i18n';
import { RowRemoveTrailing } from './RowRemoveTrailing';

export interface ReferrerRowProps {
  referral: ProjectReferralWithProfile;
  onPress?: () => void;
  /** Admin-only: remove this referrer. Renders a trailing remove control. */
  onRemove?: () => void;
  removing?: boolean;
}

/** One project referrer: name + their percentage cut. */
export function ReferrerRow({ referral, onPress, onRemove, removing }: ReferrerRowProps) {
  const t = useT();
  const pct = (
    <Txt variant="bodyMedium" mono tabularNums>
      {referral.percent}%
    </Txt>
  );
  return (
    <ListItem
      title={displayName(referral.profile)}
      subtitle={t('comp.project.referralCut')}
      onPress={onPress}
      trailing={
        onRemove ? (
          <RowRemoveTrailing onRemove={onRemove} removing={removing} label={displayName(referral.profile)}>
            {pct}
          </RowRemoveTrailing>
        ) : (
          pct
        )
      }
    />
  );
}
