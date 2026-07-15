import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState, IconButton, StackScreen, spacing } from '@chrono/ui';
import { canManage, displayName, remainingReferralPct } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { useProject } from '@/lib/hooks/use-projects';
import { useCompanyMembers } from '@/lib/hooks/use-company-members';
import { useProjectReferrals, useProjectReferralMutations } from '@/lib/hooks/use-project-referrals';
import { ReferrerRow } from '@/components/projects/ReferrerRow';
import { AddReferrerForm } from '@/components/projects/AddReferrerForm';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState, InlineError } from '@/components/common/ErrorState';

export default function ProjectReferrersScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useActiveCompany();
  const manager = canManage(role);
  const admin = role === 'admin';

  const { data: project } = useProject(id);
  const { data: companyMembers } = useCompanyMembers(project?.company_id);
  const { data: referrals, isLoading, error, refetch } = useProjectReferrals(id);
  const referralMut = useProjectReferralMutations();
  const [adding, setAdding] = useState(false);

  const candidates = useMemo(() => {
    const existing = new Set((referrals ?? []).map((r) => r.user_id));
    return (companyMembers ?? [])
      .filter((m) => !existing.has(m.user_id))
      .map((m) => ({ label: displayName(m.profile), value: m.user_id }));
  }, [companyMembers, referrals]);

  const remainingPct = remainingReferralPct(referrals ?? []);

  const addReferrer = async (userId: string, percent: number) => {
    if (!project) return;
    await referralMut.add({ project_id: project.id, company_id: project.company_id, user_id: userId, percent });
    setAdding(false);
  };

  if (!manager) {
    return (
      <StackScreen title={t('details.referrers')} onBack={() => router.back()}>
        <EmptyState icon="lock-closed-outline" title={t('common.managersOnly')} />
      </StackScreen>
    );
  }

  return (
    <StackScreen
      title={t('details.referrers')}
      onBack={() => router.back()}
      headerRight={admin && !adding ? <IconButton name="add" onPress={() => setAdding(true)} accessibilityLabel={t('common.add')} /> : undefined}
    >
      <View style={{ gap: spacing.md }}>
        {adding ? (
          <>
            <AddReferrerForm
              candidates={candidates}
              remainingPct={remainingPct}
              onAdd={addReferrer}
              onCancel={() => setAdding(false)}
              isSubmitting={referralMut.isPending}
            />
            {referralMut.error ? <InlineError error={referralMut.error} /> : null}
          </>
        ) : null}

        {isLoading && !referrals ? (
          <ScreenLoader />
        ) : error && !referrals ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (referrals ?? []).length === 0 && !adding ? (
          <EmptyState
            icon="git-branch-outline"
            title={admin ? t('common.noneYet') : t('details.noReferrers')}
            tone="accent"
          />
        ) : (
          <View>
            {(referrals ?? []).map((referral) => (
              <ReferrerRow
                key={referral.id}
                referral={referral}
                onRemove={admin ? () => void referralMut.remove(referral.id) : undefined}
                removing={referralMut.isPending}
              />
            ))}
          </View>
        )}
      </View>
    </StackScreen>
  );
}
