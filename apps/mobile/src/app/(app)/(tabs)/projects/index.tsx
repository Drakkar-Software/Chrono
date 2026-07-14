import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState, StackScreen, spacing } from '@chrono/ui';
import { canManage, companyCurrency } from '@chrono/sdk';
import type { TablesInsert } from '@chrono/sdk';

import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useMyProjects, useProjects } from '@/lib/hooks/use-projects';
import { useProjectMutations } from '@/lib/hooks/use-project-mutations';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { NewProjectForm, type NewProjectValues } from '@/components/projects/NewProjectForm';

export default function ProjectsScreen() {
  const router = useRouter();
  const { user } = useAppAuth();
  const { companyId, company, role } = useActiveCompany();
  const manager = canManage(role);
  const currency = companyCurrency(company);

  const managed = useProjects(manager ? companyId ?? undefined : undefined);
  const mine = useMyProjects(!manager ? user?.id : undefined, !manager ? companyId ?? undefined : undefined);
  const projects = manager ? managed.data : mine.data;

  const { create, isPending } = useProjectMutations();
  const [creating, setCreating] = useState(false);

  const onCreate = async (values: NewProjectValues) => {
    if (!companyId || !user?.id) return;
    const input: TablesInsert<'projects'> = {
      company_id: companyId,
      name: values.name,
      client_name: values.clientName || null,
      default_tjm_cents: values.defaultTjmCents,
      hours_per_day: values.hoursPerDay,
      created_by: user.id,
    };
    await create(input);
    setCreating(false);
  };

  const headerRight = useMemo(
    () =>
      manager && !creating ? (
        <Button title="New" size="sm" onPress={() => setCreating(true)} />
      ) : undefined,
    [manager, creating],
  );

  return (
    <StackScreen title="Projects" headerRight={headerRight}>
      <View style={styles.wrap}>
        {creating ? (
          <NewProjectForm onCreate={onCreate} onCancel={() => setCreating(false)} isSubmitting={isPending} />
        ) : null}

        {(projects ?? []).length === 0 && !creating ? (
          <EmptyState
            icon="folder-outline"
            title="No projects"
            subtitle={manager ? 'Create your first project to start tracking time.' : 'You are not assigned to any projects yet.'}
          />
        ) : (
          (projects ?? []).map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              currency={currency}
              onPress={() => router.push(`/project/${project.id}`)}
            />
          ))
        )}
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
});
