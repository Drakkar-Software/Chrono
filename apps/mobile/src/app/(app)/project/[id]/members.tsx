import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState, IconButton, StackScreen, spacing } from '@chrono/ui';
import { canManage, displayName } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useProject } from '@/lib/hooks/use-projects';
import { useProjectMembers, useProjectMemberMutations } from '@/lib/hooks/use-project-members';
import { useCompanyMembers } from '@/lib/hooks/use-company-members';
import { ProjectMemberRow } from '@/components/projects/ProjectMemberRow';
import { AddProjectMemberForm } from '@/components/projects/AddProjectMemberForm';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState, InlineError } from '@/components/common/ErrorState';
import { companyCurrency } from '@chrono/sdk';

export default function ProjectMembersScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAppAuth();
  const { company, role } = useActiveCompany();
  const manager = canManage(role);
  const currency = companyCurrency(company);

  const { data: project } = useProject(id);
  const { data: members, isLoading, error, refetch } = useProjectMembers(id);
  const { data: companyMembers } = useCompanyMembers(project?.company_id);
  const memberMut = useProjectMemberMutations();
  const [adding, setAdding] = useState(false);

  const candidates = useMemo(() => {
    const assigned = new Set((members ?? []).map((m) => m.user_id));
    return (companyMembers ?? [])
      .filter((m) => !assigned.has(m.user_id))
      .map((m) => ({ label: displayName(m.profile), value: m.user_id }));
  }, [companyMembers, members]);

  const addMember = async (userId: string, tjmCents: number | null) => {
    if (!project) return;
    await memberMut.add({ project_id: project.id, user_id: userId, tjm_cents: tjmCents });
    setAdding(false);
  };

  return (
    <StackScreen
      title={t('details.members')}
      onBack={() => router.back()}
      headerRight={manager && !adding ? <IconButton name="add" onPress={() => setAdding(true)} accessibilityLabel={t('common.add')} /> : undefined}
    >
      <View style={{ gap: spacing.md }}>
        {adding ? (
          <>
            <AddProjectMemberForm
              candidates={candidates}
              onAdd={addMember}
              onCancel={() => setAdding(false)}
              isSubmitting={memberMut.isPending}
            />
            {memberMut.error ? <InlineError error={memberMut.error} /> : null}
          </>
        ) : null}

        {isLoading && !members ? (
          <ScreenLoader />
        ) : error && !members ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (members ?? []).length === 0 && !adding ? (
          <EmptyState icon="people-outline" title={t('details.noMembers')} tone="accent" />
        ) : project ? (
          <View>
            {(members ?? []).map((member) => (
              <ProjectMemberRow
                key={member.id}
                member={member}
                project={project}
                currency={currency}
                showRate={manager || member.user_id === user?.id}
                onRemove={manager ? () => void memberMut.remove(member.id) : undefined}
                removing={memberMut.isPending}
              />
            ))}
          </View>
        ) : null}
      </View>
    </StackScreen>
  );
}
