import { View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, ListItem, Money, StackScreen, Txt, formatMoney, spacing } from '@chrono/ui';
import {
  canManage,
  companyCurrency,
  monthlyRecurringAmount,
  sourceClientTjm,
  sourceManualAmount,
  totalCostForMonth,
  valueUninvoicedTime,
} from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useProject } from '@/lib/hooks/use-projects';
import { useProjectMutations } from '@/lib/hooks/use-project-mutations';
import { useProjectMembers } from '@/lib/hooks/use-project-members';
import { useRevenueSources } from '@/lib/hooks/use-revenue-sources';
import { useProjectCosts } from '@/lib/hooks/use-project-costs';
import { useProjectReferrals } from '@/lib/hooks/use-project-referrals';
import { useRevenueEntries } from '@/lib/hooks/use-revenue-entries';
import { useReferralEarnings } from '@/lib/hooks/use-referral-earnings';
import { useInvoices } from '@/lib/hooks/use-invoices';
import { useTimeEntries } from '@/lib/hooks/use-time-entries';
import { projectBadge } from '@/lib/status';
import { todayISO } from '@/lib/date';
import { EditProjectForm, type EditProjectValues } from '@/components/projects/EditProjectForm';
import { ProjectPnLCard } from '@/components/reports/ProjectPnLCard';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState, InlineError } from '@/components/common/ErrorState';
import { StatRow, StatTile } from '@/components/ui/StatTile';
import { useCallback, useRef, useState } from 'react';

export default function ProjectDetail() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAppAuth();
  const { company, role } = useActiveCompany();
  const manager = canManage(role);
  const currency = companyCurrency(company);

  const { data: project, isLoading, error: projectError, refetch: refetchProject } = useProject(id);
  const companyId = project?.company_id;

  // Fetched here only for the entry-row counts/summaries below — each
  // sub-screen fetches its own full data independently.
  const { data: members, refetch: refetchMembers } = useProjectMembers(id);
  const { data: sources, refetch: refetchSources } = useRevenueSources(id);
  const { data: costs, refetch: refetchCosts } = useProjectCosts(id, companyId);
  const { data: referrals, refetch: refetchReferrals } = useProjectReferrals(id);
  const isProjectMember = (members ?? []).some((m) => m.user_id === user?.id);

  // P&L data for this one project (single-project reads, not a fan-out).
  const { data: pnlRevenue, refetch: refetchPnlRevenue } = useRevenueEntries(manager ? id : undefined);
  const { data: pnlReferrals, refetch: refetchPnlReferrals } = useReferralEarnings(
    manager ? { projectId: id, companyId: companyId ?? undefined } : {},
  );
  const { data: pnlInvoices, refetch: refetchPnlInvoices } = useInvoices({
    companyId: manager ? companyId ?? '' : '',
    projectId: id,
  });
  // Approved billable time not yet invoiced, valued into the P&L card's "net
  // available funding" — a live preview of what's really left to spend.
  const { data: uninvoicedEntries, refetch: refetchUninvoiced } = useTimeEntries({
    companyId: manager ? companyId ?? '' : '',
    projectId: id,
    status: 'approved',
    billable: true,
    uninvoiced: true,
  });

  // Sub-screens (revenue sources, fixed costs, expenses, ...) are separate
  // routes reached via router.push, and RPCs run there (payments, settlement,
  // revenue recognition) don't always go through a store this screen
  // subscribes to. Refetch everything on refocus so the figures shown here
  // are current when the user comes back. Skip the very first focus — mount
  // already fetched.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void refetchProject();
      void refetchMembers();
      void refetchSources();
      void refetchCosts();
      void refetchReferrals();
      void refetchPnlRevenue();
      void refetchPnlReferrals();
      void refetchPnlInvoices();
      void refetchUninvoiced();
    }, [
      refetchProject,
      refetchMembers,
      refetchSources,
      refetchCosts,
      refetchReferrals,
      refetchPnlRevenue,
      refetchPnlReferrals,
      refetchPnlInvoices,
      refetchUninvoiced,
    ]),
  );

  const projectMut = useProjectMutations();
  const [editing, setEditing] = useState(false);

  const saveEdits = async (values: EditProjectValues) => {
    if (!project) return;
    await projectMut.update(project.id, {
      name: values.name,
      client_name: values.clientName || null,
      description: values.description || null,
      default_tjm_cents: values.defaultTjmCents,
      budget_cents: values.budgetCents,
      hours_per_day: values.hoursPerDay,
      status: values.status,
      vat_rate: values.vatRate,
    });
    await refetchProject();
    setEditing(false);
  };
  const toggleArchive = async () => {
    if (!project) return;
    await projectMut.update(project.id, {
      status: project.status === 'archived' ? 'active' : 'archived',
    });
    await refetchProject();
  };

  if (isLoading && !project) {
    return (
      <StackScreen title={t('details.project')} onBack={() => router.back()}>
        <ScreenLoader />
      </StackScreen>
    );
  }
  if (projectError && !project) {
    return (
      <StackScreen title={t('details.project')} onBack={() => router.back()}>
        <ErrorState
          error={projectError}
          title={t('details.projectLoadError')}
          onRetry={() => {
            void refetchProject();
          }}
        />
      </StackScreen>
    );
  }
  if (!project) {
    return (
      <StackScreen title={t('details.project')} onBack={() => router.back()}>
        <EmptyState
          icon="folder-outline"
          title={t('details.projectNotFound')}
          subtitle={t('details.mayHaveBeenRemoved')}
        />
      </StackScreen>
    );
  }

  const revenueSourcesTotalCents = (sources ?? []).reduce((acc, source) => {
    const amount =
      source.type === 'recurring'
        ? monthlyRecurringAmount(source)
        : (sourceManualAmount(source) ?? sourceClientTjm(source));
    return acc + amount;
  }, 0);
  // This month's applicable pool cost — the counterpart to the monthly RATE in
  // `revenueSourcesTotalCents` above, so the two figures compare like for like.
  // A raw sum of recurring rows would ignore `active`, the [starts_on, ends_on]
  // window, and any one_off landing this month.
  const costsTotalCents = totalCostForMonth(costs ?? [], todayISO());
  const uninvoicedTimeCents = valueUninvoicedTime(uninvoicedEntries ?? [], project, members ?? []);

  return (
    <StackScreen title={project.name} onBack={() => router.back()}>
      <View style={{ gap: spacing.xl }}>
        {manager && editing ? (
          <EditProjectForm
            project={project}
            onSave={saveEdits}
            onCancel={() => setEditing(false)}
            isSubmitting={projectMut.isPending}
          />
        ) : (
          <Card padding="lg" style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="title" numberOfLines={2}>
                  {project.name}
                </Txt>
                {project.client_name ? (
                  <Txt variant="body" tone="textMuted">
                    {project.client_name}
                  </Txt>
                ) : null}
              </View>
              <Badge label={t('status.' + project.status)} status={projectBadge(project.status)} />
            </View>
            {manager ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title={t('common.edit')} size="sm" variant="secondary" onPress={() => setEditing(true)} />
                <Button
                  title={project.status === 'archived' ? t('details.unarchive') : t('details.archive')}
                  size="sm"
                  variant="ghost"
                  onPress={toggleArchive}
                  loading={projectMut.isPending}
                />
              </View>
            ) : null}
            {projectMut.error ? <InlineError error={projectMut.error} /> : null}
          </Card>
        )}

        {manager && companyId ? (
          <ProjectPnLCard
            project={project}
            currency={currency}
            revenueEntries={pnlRevenue ?? []}
            referralEarnings={pnlReferrals ?? []}
            invoices={pnlInvoices ?? []}
            costs={costs ?? []}
            uninvoicedTimeCents={uninvoicedTimeCents}
          />
        ) : null}

        <Card padding="none">
          <ListItem
            title={t('details.members')}
            subtitle={t('details.membersCount', { count: (members ?? []).length })}
            onPress={() => router.push(`/project/${id}/members`)}
          />
          {manager ? (
            <ListItem
              title={t('details.revenueSources')}
              subtitle={t('details.revenueSourcesCount', { count: (sources ?? []).length })}
              trailing={
                revenueSourcesTotalCents > 0 ? (
                  <Money cents={revenueSourcesTotalCents} currency={currency} tone="textMuted" />
                ) : undefined
              }
              onPress={() => router.push(`/project/${id}/revenue-sources`)}
            />
          ) : null}
          {manager || isProjectMember ? (
            <ListItem
              title={t('details.costs')}
              subtitle={t('details.costsCount', { count: (costs ?? []).length })}
              trailing={
                manager && costsTotalCents > 0 ? (
                  <Money cents={costsTotalCents} currency={currency} tone="textMuted" />
                ) : undefined
              }
              onPress={() => router.push(`/project/${id}/costs`)}
            />
          ) : null}
          {manager ? (
            <ListItem
              title={t('details.referrers')}
              subtitle={t('details.referrersCount', { count: (referrals ?? []).length })}
              onPress={() => router.push(`/project/${id}/referrers`)}
              divider={false}
            />
          ) : null}
        </Card>

        <Card padding="lg" style={{ gap: spacing.md }}>
          <Txt variant="heading">{t('details.rateAndCapacity')}</Txt>
          <StatRow>
            <StatTile
              label={t('details.defaultTjm')}
              value={project.default_tjm_cents != null ? formatMoney(project.default_tjm_cents, currency) : '—'}
            />
            <StatTile label={t('details.hoursPerDay')} value={String(project.hours_per_day)} />
            {project.budget_cents != null ? (
              <StatTile label={t('details.budget')} value={formatMoney(project.budget_cents, currency)} />
            ) : null}
          </StatRow>
        </Card>
      </View>
    </StackScreen>
  );
}
