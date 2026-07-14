import { ListItem, Money } from '@chrono/ui';
import { displayName, effectiveTjm } from '@chrono/sdk';
import type { Project, ProjectMemberWithProfile } from '@chrono/sdk';
import { useT } from '@/lib/i18n';

export interface ProjectMemberRowProps {
  member: ProjectMemberWithProfile;
  project: Pick<Project, 'default_tjm_cents'>;
  currency: string;
  onPress?: () => void;
}

/** A project member: name + their effective day rate. */
export function ProjectMemberRow({ member, project, currency, onPress }: ProjectMemberRowProps) {
  const t = useT();
  return (
    <ListItem
      title={displayName(member.profile)}
      subtitle={t('comp.project.dayRate')}
      onPress={onPress}
      trailing={<Money cents={effectiveTjm(member, project)} currency={currency} />}
    />
  );
}
