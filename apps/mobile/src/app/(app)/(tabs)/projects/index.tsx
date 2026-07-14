import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState, StackScreen, spacing, useResponsive } from '@chrono/ui';
import { canManage, companyCurrency } from '@chrono/sdk';
import type { TablesInsert } from '@chrono/sdk';

import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useMyProjects, useProjects } from '@/lib/hooks/use-projects';
import { useProjectMutations } from '@/lib/hooks/use-project-mutations';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { NewProjectForm, type NewProjectValues } from '@/components/projects/NewProjectForm';
import { ScreenLoader } from '@/components/common/ScreenLoader';

export default function ProjectsScreen() {
  const router = useRouter();
  const { isWide } = useResponsive();
  const { user } = useAppAuth();
  const { companyId, company, role } = useActiveCompany();
  const manager = canManage(role);
  const currency = companyCurrency(company);

  const managed = useProjects(manager ? companyId ?? undefined : undefined);
  const mine = useMyProjects(!manager ? user?.id : undefined, !manager ? companyId ?? undefined : undefined);
  const projects = manager ? managed.data : mine.data;
  const loading = manager ? managed.isLoading : mine.isLoading;

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

  const list = projects ?? [];

  return (
    <StackScreen title="Projects" headerRight={headerRight}>
      <View style={styles.wrap}>
        {creating ? (
          <NewProjectForm onCreate={onCreate} onCancel={() => setCreating(false)} isSubmitting={isPending} />
        ) : null}

        {loading && projects == null ? (
          <ScreenLoader />
        ) : list.length === 0 && !creating ? (
          <EmptyState
            icon="folder-outline"
            title="No projects"
            subtitle={manager ? 'Create your first project to start tracking time.' : 'You are not assigned to any projects yet.'}
            action={manager ? <Button title="New project" onPress={() => setCreating(true)} /> : undefined}
          />
        ) : (
          <View style={styles.grid}>
            {list.map((project) => (
              <View key={project.id} style={[styles.cell, isWide ? styles.cellWide : styles.cellFull]}>
                <ProjectCard
                  project={project}
                  currency={currency}
                  onPress={() => router.push(`/project/${project.id}`)}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { flexGrow: 1 },
  cellWide: { flexBasis: '31%', minWidth: 220 },
  cellFull: { flexBasis: '100%' },
});
