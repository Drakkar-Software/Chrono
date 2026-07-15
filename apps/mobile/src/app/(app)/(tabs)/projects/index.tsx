import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, CardGrid, EmptyState, StackScreen, spacing } from '@chrono/ui';
import { canManage, companyCurrency } from '@chrono/sdk';
import type { TablesInsert } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useMyProjects, useProjects } from '@/lib/hooks/use-projects';
import { useProjectMutations } from '@/lib/hooks/use-project-mutations';
import { usePagination } from '@/lib/hooks/use-pagination';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { NewProjectForm, type NewProjectValues } from '@/components/projects/NewProjectForm';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadMore } from '@/components/common/LoadMore';

export default function ProjectsScreen() {
  const t = useT();
  const router = useRouter();
  const { user } = useAppAuth();
  const { companyId, company, role } = useActiveCompany();
  const manager = canManage(role);
  const currency = companyCurrency(company);

  const managed = useProjects(manager ? companyId ?? undefined : undefined);
  const mine = useMyProjects(!manager ? user?.id : undefined, !manager ? companyId ?? undefined : undefined);
  const projects = manager ? managed.data : mine.data;
  const loading = manager ? managed.isLoading : mine.isLoading;
  const error = manager ? managed.error : mine.error;
  const refetch = manager ? managed.refetch : mine.refetch;

  const { create, isPending } = useProjectMutations();
  const [creating, setCreating] = useState(false);

  const onCreate = async (values: NewProjectValues) => {
    if (!companyId || !user?.id) return;
    const input: TablesInsert<'projects'> = {
      company_id: companyId,
      name: values.name,
      client_name: values.clientName || null,
      description: values.description || null,
      default_tjm_cents: values.defaultTjmCents,
      budget_cents: values.budgetCents,
      hours_per_day: values.hoursPerDay,
      created_by: user.id,
    };
    await create(input);
    setCreating(false);
  };

  const headerRight = useMemo(
    () =>
      manager && !creating ? (
        <Button title={t('common.new')} size="sm" onPress={() => setCreating(true)} />
      ) : undefined,
    [manager, creating, t],
  );

  const list = projects ?? [];
  const { page, hasMore, loadMore } = usePagination(
    list,
    `${companyId ?? ''}:${manager ? 'managed' : 'mine'}`,
  );

  return (
    <StackScreen title={t('tabs.nav.projects')} headerRight={headerRight}>
      <View style={styles.wrap}>
        {creating ? (
          <NewProjectForm onCreate={onCreate} onCancel={() => setCreating(false)} isSubmitting={isPending} />
        ) : null}

        {loading && projects == null ? (
          <ScreenLoader />
        ) : error && projects == null ? (
          <ErrorState
            error={error}
            title={t('tabs.projects.loadError')}
            onRetry={() => {
              void refetch();
            }}
          />
        ) : list.length === 0 && !creating ? (
          <EmptyState
            icon="folder-outline"
            title={t('tabs.projects.empty')}
            subtitle={manager ? t('tabs.projects.emptyManager') : t('tabs.projects.emptyFreelancer')}
            action={manager ? <Button title={t('tabs.projects.newProject')} onPress={() => setCreating(true)} /> : undefined}
            tone="accent"
          />
        ) : (
          <>
            <CardGrid single>
              {page.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  currency={currency}
                  onPress={() => router.push(`/project/${project.id}`)}
                />
              ))}
            </CardGrid>
            <LoadMore hasMore={hasMore} onLoadMore={loadMore} remaining={list.length - page.length} />
          </>
        )}
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
});
