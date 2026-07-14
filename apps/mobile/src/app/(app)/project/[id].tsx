import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, StackScreen, Txt, formatMoney, spacing } from '@chrono/ui';
import {
  canManage,
  companyCurrency,
  displayName,
  projectStatusLabel,
  remainingReferralPct,
} from '@chrono/sdk';

import { useActiveCompany } from '@/lib/active-company-context';
import { useProject } from '@/lib/hooks/use-projects';
import { useProjectMembers, useProjectMemberMutations } from '@/lib/hooks/use-project-members';
import { useCompanyMembers } from '@/lib/hooks/use-company-members';
import { useRevenueSources, useRevenueSourceMutations } from '@/lib/hooks/use-revenue-sources';
import { useProjectReferrals, useProjectReferralMutations } from '@/lib/hooks/use-project-referrals';
import { projectBadge } from '@/lib/status';
import { ProjectMemberRow } from '@/components/projects/ProjectMemberRow';
import { RevenueSourceRow } from '@/components/projects/RevenueSourceRow';
import { ReferrerRow } from '@/components/projects/ReferrerRow';
import { AddProjectMemberForm } from '@/components/projects/AddProjectMemberForm';
import { AddRevenueSourceForm, type AddRevenueSourceValues } from '@/components/projects/AddRevenueSourceForm';
import { AddReferrerForm } from '@/components/projects/AddReferrerForm';
import { ProjectPnLCard } from '@/components/reports/ProjectPnLCard';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { StatRow, StatTile } from '@/components/ui/StatTile';

type Panel = 'none' | 'member' | 'source' | 'referrer';

export default function ProjectDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { company, role } = useActiveCompany();
  const manager = canManage(role);
  const admin = role === 'admin';
  const currency = companyCurrency(company);

  const { data: project, isLoading } = useProject(id);
  const companyId = project?.company_id;

  const { data: members } = useProjectMembers(id);
  const { data: companyMembers } = useCompanyMembers(companyId);
  const { data: sources } = useRevenueSources(id);
  const { data: referrals } = useProjectReferrals(id);

  const memberMut = useProjectMemberMutations();
  const sourceMut = useRevenueSourceMutations();
  const referralMut = useProjectReferralMutations();

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
      <StackScreen title="Project" onBack={() => router.back()}>
        <ScreenLoader />
      </StackScreen>
    );
  }
  if (!project) {
    return (
      <StackScreen title="Project" onBack={() => router.back()}>
        <EmptyState icon="folder-outline" title="Project not found" subtitle="It may have been removed." />
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

  return (
    <StackScreen title={project.name} onBack={() => router.back()}>
      <View style={styles.wrap}>
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
            <Badge label={projectStatusLabel(project.status)} status={projectBadge(project.status)} />
          </View>
          <StatRow>
            <StatTile
              label="Default TJM"
              value={project.default_tjm_cents != null ? formatMoney(project.default_tjm_cents, currency) : '—'}
            />
            <StatTile label="Hours / day" value={String(project.hours_per_day)} />
            {project.budget_cents != null ? (
              <StatTile label="Budget" value={formatMoney(project.budget_cents, currency)} />
            ) : null}
          </StatRow>
        </Card>

        <Section
          title="Members"
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
            <ProjectMemberRow key={member.id} member={member} project={project} currency={currency} />
          ))}
          {(members ?? []).length === 0 && panel !== 'member' ? (
            <Txt variant="body" tone="textMuted">
              None yet
            </Txt>
          ) : null}
        </Section>

        {/* Revenue config is manager-only (pricing/margins); referrer setup is admin-only. */}
        {manager ? (
          <Section
            title="Revenue sources"
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
                None yet
              </Txt>
            ) : null}
          </Section>
        ) : null}

        {manager ? (
          <Section
            title="Referrers"
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
                {admin ? 'None yet' : 'No referrers'}
              </Txt>
            ) : null}
          </Section>
        ) : null}

        {manager && companyId ? (
          <ProjectPnLCard project={project} companyId={companyId} currency={currency} />
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
  return (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        action={action ? <Button title="Add" size="sm" variant="secondary" onPress={action} /> : undefined}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  card: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  titleWrap: { flex: 1, gap: 2 },
  section: { gap: spacing.sm },
});
