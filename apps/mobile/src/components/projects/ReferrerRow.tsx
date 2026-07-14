import { ListItem, Txt } from '@chrono/ui';
import { displayName } from '@chrono/sdk';
import type { ProjectReferralWithProfile } from '@chrono/sdk';

export interface ReferrerRowProps {
  referral: ProjectReferralWithProfile;
  onPress?: () => void;
}

/** One project referrer: name + their percentage cut. */
export function ReferrerRow({ referral, onPress }: ReferrerRowProps) {
  return (
    <ListItem
      title={displayName(referral.profile)}
      subtitle="Referral cut"
      onPress={onPress}
      trailing={
        <Txt variant="bodyMedium" mono tabularNums>
          {referral.percent}%
        </Txt>
      }
    />
  );
}
