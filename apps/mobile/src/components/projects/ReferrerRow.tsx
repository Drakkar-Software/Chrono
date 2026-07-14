import { ListItem, Txt } from '@chrono/ui';
import { displayName } from '@chrono/sdk';
import type { ProjectReferralWithProfile } from '@chrono/sdk';
import { useT } from '@/lib/i18n';

export interface ReferrerRowProps {
  referral: ProjectReferralWithProfile;
  onPress?: () => void;
}

/** One project referrer: name + their percentage cut. */
export function ReferrerRow({ referral, onPress }: ReferrerRowProps) {
  const t = useT();
  return (
    <ListItem
      title={displayName(referral.profile)}
      subtitle={t('comp.project.referralCut')}
      onPress={onPress}
      trailing={
        <Txt variant="bodyMedium" mono tabularNums>
          {referral.percent}%
        </Txt>
      }
    />
  );
}
