import { ListItem, Money } from '@chrono/ui';
import { displayName, effectiveTjm } from '@chrono/sdk';
import type { Project, ProjectMemberWithProfile } from '@chrono/sdk';
import { useT } from '@/lib/i18n';
import { RowRemoveTrailing } from './RowRemoveTrailing';

export interface ProjectMemberRowProps {
  member: ProjectMemberWithProfile;
  project: Pick<Project, 'default_tjm_cents'>;
  currency: string;
  /** Show the day rate. Rates are confidential — only managers, or the member
   *  viewing their own row, should see them. Default false. */
  showRate?: boolean;
  onPress?: () => void;
  /** Manager-only: unassign this member. Renders a trailing remove control. */
  onRemove?: () => void;
  removing?: boolean;
}

/** A project member: name + (for permitted viewers) their effective day rate. */
export function ProjectMemberRow({ member, project, currency, showRate = false, onPress, onRemove, removing }: ProjectMemberRowProps) {
  const t = useT();
  const rate = showRate ? <Money cents={effectiveTjm(member, project)} currency={currency} /> : undefined;
  return (
    <ListItem
      title={displayName(member.profile)}
      subtitle={showRate ? t('comp.project.dayRate') : undefined}
      onPress={onPress}
      trailing={
        onRemove ? (
          <RowRemoveTrailing onRemove={onRemove} removing={removing} label={displayName(member.profile)}>
            {rate}
          </RowRemoveTrailing>
        ) : (
          rate
        )
      }
    />
  );
}
