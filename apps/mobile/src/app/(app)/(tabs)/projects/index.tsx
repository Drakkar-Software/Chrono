import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, CardGrid, EmptyState, StackScreen, spacing } from '@chrono/ui';
import { canManage, companyCurrency } from '@chrono/sdk';
import type { TablesInsert } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { todayISO } from '@/lib/date';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useMyProjects, useProjects } from '@/lib/hooks/use-projects';
import { useProjectMutations } from '@/lib/hooks/use-project-mutations';
import { useCompanyRevenueEntries } from '@/lib/hooks/use-revenue-entries';
import { useCompanyProjectCosts } from '@/lib/hooks/use-project-costs';
import { useReferralEarnings } from '@/lib/hooks/use-referral-earnings';
import { useInvoices } from '@/lib/hooks/use-invoices';
import { useTimeEntries } from '@/lib/hooks/use-time-entries';
import { useCompanyProjectMembers } from '@/lib/hooks/use-project-members';
import { usePagination } from '@/lib/hooks/use-pagination';
import { groupByProject, projectNetAvailableCents, uninvoicedTimeByProject } from '@/lib/reports';
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

  // Manager-only funding inputs (same sources as company P&L) — sliced per card.
  // Pass companyId only when manager so hooks stay disabled for freelancers.
  const fundingCompanyId = manager ? companyId ?? undefined : undefined;
  const {
    data: revenueEntries,
    isLoading: loadingRevenue,
  } = useCompanyRevenueEntries(fundingCompanyId);
  const {
    data: referralEarnings,
    isLoading: loadingReferrals,
  } = useReferralEarnings(fundingCompanyId ? { companyId: fundingCompanyId } : {});
  const {
    data: invoices,
    isLoading: loadingInvoices,
  } = useInvoices({ companyId: fundingCompanyId ?? '' });
  const {
    data: costs,
    isLoading: loadingCosts,
  } = useCompanyProjectCosts(fundingCompanyId);
  const {
    data: uninvoicedTimeEntries,
    isLoading: loadingUninvoiced,
  } = useTimeEntries({
    companyId: fundingCompanyId ?? '',
    status: 'approved',
    billable: true,
    uninvoiced: true,
  });
  const {
    data: projectMembers,
    isLoading: loadingMembers,
  } = useCompanyProjectMembers(fundingCompanyId);

  const fundingInputsReady =
    manager &&
    !loadingRevenue &&
    !loadingReferrals &&
    !loadingInvoices &&
    !loadingCosts &&
    !loadingUninvoiced &&
    !loadingMembers &&
    revenueEntries != null &&
    referralEarnings != null &&
    invoices != null &&
    costs != null &&
    uninvoicedTimeEntries != null &&
    projectMembers != null;

  const netAvailableByProject = useMemo(() => {
    if (!fundingInputsReady) return new Map<string, number>();
    const revenueByProject = groupByProject(revenueEntries);
    const referralsByProject = groupByProject(referralEarnings);
    const invoicesByProject = groupByProject(invoices);
    const costsByProject = groupByProject(costs);
    const membersByProject = groupByProject(projectMembers);
    const uninvoicedByProject = uninvoicedTimeByProject(uninvoicedTimeEntries, membersByProject);
    const today = todayISO();
    const out = new Map<string, number>();
    for (const project of projects ?? []) {
      out.set(
        project.id,
        projectNetAvailableCents({
          revenueEntries: revenueByProject.get(project.id) ?? [],
          referralEarnings: referralsByProject.get(project.id) ?? [],
          invoices: invoicesByProject.get(project.id) ?? [],
          costs: costsByProject.get(project.id) ?? [],
          uninvoicedTimeCents: uninvoicedByProject.get(project.id) ?? 0,
          throughDateISO: today,
        }),
      );
    }
    return out;
  }, [
    fundingInputsReady,
    projects,
    revenueEntries,
    referralEarnings,
    invoices,
    costs,
    uninvoicedTimeEntries,
    projectMembers,
  ]);

  const { create, isPending } = useProjectMutations();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

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
      rem_policy: values.remPolicy,
      jungle_fictitious_tjm_cents: values.jungleFictitiousTjmCents,
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

  const all = projects ?? [];
  const archivedCount = all.filter((p) => p.status === 'archived').length;
  const list = showArchived ? all : all.filter((p) => p.status !== 'archived');
  const { page, hasMore, loadMore } = usePagination(
    list,
    `${companyId ?? ''}:${manager ? 'managed' : 'mine'}:${showArchived ? 'all' : 'active'}`,
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
                  netAvailableCents={
                    manager && fundingInputsReady
                      ? netAvailableByProject.get(project.id)
                      : undefined
                  }
                  onPress={() => router.push(`/project/${project.id}`)}
                />
              ))}
            </CardGrid>
            <LoadMore hasMore={hasMore} onLoadMore={loadMore} remaining={list.length - page.length} />
          </>
        )}

        {archivedCount > 0 && !loading && !creating ? (
          <Button
            title={showArchived ? t('tabs.projects.hideArchived') : t('tabs.projects.showArchived')}
            variant="ghost"
            onPress={() => setShowArchived((v) => !v)}
          />
        ) : null}
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
});
