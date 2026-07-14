import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, StackScreen, Txt, formatMoney, spacing } from '@chrono/ui';
import {
  canManage,
  companyCurrency,
  displayName,
  remainingReferralPct,
} from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useProject } from '@/lib/hooks/use-projects';
import { useProjectMutations } from '@/lib/hooks/use-project-mutations';
import { useProjectMembers, useProjectMemberMutations } from '@/lib/hooks/use-project-members';
import { useCompanyMembers } from '@/lib/hooks/use-company-members';
import { useRevenueSources, useRevenueSourceMutations } from '@/lib/hooks/use-revenue-sources';
import { useProjectReferrals, useProjectReferralMutations } from '@/lib/hooks/use-project-referrals';
import { useRevenueEntries } from '@/lib/hooks/use-revenue-entries';
import { useReferralEarnings } from '@/lib/hooks/use-referral-earnings';
import { useInvoices } from '@/lib/hooks/use-invoices';
import { projectBadge } from '@/lib/status';
import { ProjectMemberRow } from '@/components/projects/ProjectMemberRow';
import { RevenueSourceRow } from '@/components/projects/RevenueSourceRow';
import { ReferrerRow } from '@/components/projects/ReferrerRow';
import { AddProjectMemberForm } from '@/components/projects/AddProjectMemberForm';
import { AddRevenueSourceForm, type AddRevenueSourceValues } from '@/components/projects/AddRevenueSourceForm';
import { AddReferrerForm } from '@/components/projects/AddReferrerForm';
import { EditProjectForm, type EditProjectValues } from '@/components/projects/EditProjectForm';
import { ProjectPnLCard } from '@/components/reports/ProjectPnLCard';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState, InlineError } from '@/components/common/ErrorState';
import { StatRow, StatTile } from '@/components/ui/StatTile';

type Panel = 'none' | 'edit' | 'member' | 'source' | 'referrer';

export default function ProjectDetail() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAppAuth();
  const { company, role } = useActiveCompany();
  const manager = canManage(role);
  const admin = role === 'admin';
  const currency = companyCurrency(company);

  const { data: project, isLoading, error: projectError, refetch: refetchProject } = useProject(id);
  const companyId = project?.company_id;

  const { data: members } = useProjectMembers(id);
  const { data: companyMembers } = useCompanyMembers(companyId);
  const { data: sources } = useRevenueSources(id);
  const { data: referrals } = useProjectReferrals(id);

  // P&L data for this one project (single-project reads, not a fan-out).
  const { data: pnlRevenue } = useRevenueEntries(manager ? id : undefined);
  const { data: pnlReferrals } = useReferralEarnings(
    manager ? { projectId: id, companyId: companyId ?? undefined } : {},
  );
  const { data: pnlInvoices } = useInvoices({
    companyId: manager ? companyId ?? '' : '',
    projectId: id,
  });

  const memberMut = useProjectMemberMutations();
  const sourceMut = useRevenueSourceMutations();
  const referralMut = useProjectReferralMutations();
  const projectMut = useProjectMutations();

  const [panel, setPanel] = useState<Panel>('none');

  const memberCandidates = useMemo(() => {
    const assigned = new Set((members ?? []).map((m) => m.user_id));
    return (companyMembers ?? [])
      .filter((m) => !assigned.has(m.user_id))
      .map((m) => ({ label: displayName(m.profile), value: m.user_id }));
  }, [companyMembers, members]);

  const referrerCandidates = useMemo(() => {
    const existing = new Set((referrals ?? []).map((r) => r.user_id));
    return (companyMembers ?? [])
      .filter((m) => !existing.has(m.user_id))
      .map((m) => ({ label: displayName(m.profile), value: m.user_id }));
  }, [companyMembers, referrals]);

  const remainingPct = remainingReferralPct(referrals ?? []);

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

  const addMember = async (userId: string, tjmCents: number | null) => {
    await memberMut.add({ project_id: project.id, user_id: userId, tjm_cents: tjmCents });
    setPanel('none');
  };
  const addSource = async (values: AddRevenueSourceValues) => {
    if (!companyId) return;
    await sourceMut.create({
      project_id: project.id,
      company_id: companyId,
      type: values.type,
      name: values.name,
      content: values.content,
    });
    setPanel('none');
  };
  const addReferrer = async (userId: string, percent: number) => {
    if (!companyId) return;
    await referralMut.add({ project_id: project.id, company_id: companyId, user_id: userId, percent });
    setPanel('none');
  };
  const saveEdits = async (values: EditProjectValues) => {
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
    setPanel('none');
  };
  const toggleArchive = async () => {
    await projectMut.update(project.id, {
      status: project.status === 'archived' ? 'active' : 'archived',
    });
    await refetchProject();
  };

  return (
    <StackScreen title={project.name} onBack={() => router.back()}>
      <View style={styles.wrap}>
        {manager && panel === 'edit' ? (
          <EditProjectForm
            project={project}
            onSave={saveEdits}
            onCancel={() => setPanel('none')}
            isSubmitting={projectMut.isPending}
          />
        ) : (
          <Card padding="lg" style={styles.card}>
            <View style={styles.header}>
              <View style={styles.titleWrap}>
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
            {manager ? (
              <View style={styles.headerActions}>
                <Button title={t('common.edit')} size="sm" variant="secondary" onPress={() => setPanel('edit')} />
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

        <Section
          title={t('details.members')}
          action={manager && panel !== 'member' ? () => setPanel('member') : undefined}
        >
          {panel === 'member' ? (
            <AddProjectMemberForm
              candidates={memberCandidates}
              onAdd={addMember}
              onCancel={() => setPanel('none')}
              isSubmitting={memberMut.isPending}
            />
          ) : null}
          {(members ?? []).map((member) => (
            <ProjectMemberRow
              key={member.id}
              member={member}
              project={project}
              currency={currency}
              showRate={manager || member.user_id === user?.id}
            />
          ))}
          {(members ?? []).length === 0 && panel !== 'member' ? (
            <Txt variant="body" tone="textMuted">
              {t('common.noneYet')}
            </Txt>
          ) : null}
        </Section>

        {/* Revenue config is manager-only (pricing/margins); referrer setup is admin-only. */}
        {manager ? (
          <Section
            title={t('details.revenueSources')}
            action={panel !== 'source' ? () => setPanel('source') : undefined}
          >
            {panel === 'source' ? (
              <AddRevenueSourceForm
                onAdd={addSource}
                onCancel={() => setPanel('none')}
                isSubmitting={sourceMut.isPending}
              />
            ) : null}
            {(sources ?? []).map((source) => (
              <RevenueSourceRow key={source.id} source={source} currency={currency} />
            ))}
            {(sources ?? []).length === 0 && panel !== 'source' ? (
              <Txt variant="body" tone="textMuted">
                {t('common.noneYet')}
              </Txt>
            ) : null}
          </Section>
        ) : null}

        {manager ? (
          <Section
            title={t('details.referrers')}
            action={admin && panel !== 'referrer' ? () => setPanel('referrer') : undefined}
          >
            {panel === 'referrer' ? (
              <AddReferrerForm
                candidates={referrerCandidates}
                remainingPct={remainingPct}
                onAdd={addReferrer}
                onCancel={() => setPanel('none')}
                isSubmitting={referralMut.isPending}
              />
            ) : null}
            {(referrals ?? []).map((referral) => (
              <ReferrerRow key={referral.id} referral={referral} />
            ))}
            {(referrals ?? []).length === 0 && panel !== 'referrer' ? (
              <Txt variant="body" tone="textMuted">
                {admin ? t('common.noneYet') : t('details.noReferrers')}
              </Txt>
            ) : null}
          </Section>
        ) : null}

        {manager && companyId ? (
          <ProjectPnLCard
            project={project}
            currency={currency}
            revenueEntries={pnlRevenue ?? []}
            referralEarnings={pnlReferrals ?? []}
            invoices={pnlInvoices ?? []}
          />
        ) : null}
      </View>
    </StackScreen>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: () => void;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        action={action ? <Button title={t('common.add')} size="sm" variant="secondary" onPress={action} /> : undefined}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  card: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  titleWrap: { flex: 1, gap: 2 },
  section: { gap: spacing.sm },
});
