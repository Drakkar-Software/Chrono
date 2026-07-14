import { ListItem, Money } from '@chrono/ui';
import { displayName, effectiveTjm } from '@chrono/sdk';
import type { Project, ProjectMemberWithProfile } from '@chrono/sdk';
import { useT } from '@/lib/i18n';

export interface ProjectMemberRowProps {
  member: ProjectMemberWithProfile;
  project: Pick<Project, 'default_tjm_cents'>;
  currency: string;
  /** Show the day rate. Rates are confidential — only managers, or the member
   *  viewing their own row, should see them. Default false. */
  showRate?: boolean;
  onPress?: () => void;
}

/** A project member: name + (for permitted viewers) their effective day rate. */
export function ProjectMemberRow({ member, project, currency, showRate = false, onPress }: ProjectMemberRowProps) {
  const t = useT();
  return (
    <ListItem
      title={displayName(member.profile)}
      subtitle={showRate ? t('comp.project.dayRate') : undefined}
      onPress={onPress}
      trailing={showRate ? <Money cents={effectiveTjm(member, project)} currency={currency} /> : undefined}
    />
  );
}
