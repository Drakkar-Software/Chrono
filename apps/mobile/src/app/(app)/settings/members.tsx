import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { EmptyState, StackScreen, TitledCard, spacing } from '@chrono/ui';
import { DEFAULT_WORKING_WEEKDAYS, canManage } from '@chrono/sdk';
import type { AppRole } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useCompanyMembers, useCompanyMemberMutations } from '@/lib/hooks/use-company-members';
import { MemberRow } from '@/components/settings/MemberRow';
import { InvitesCard } from '@/components/settings/InvitesCard';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { InlineError } from '@/components/common/ErrorState';

export default function MembersSettingsScreen() {
  const t = useT();
  const router = useRouter();
  const { user } = useAppAuth();
  const { company, role } = useActiveCompany();
  const manager = canManage(role);
  const isAdmin = role === 'admin';

  const { data: members, isLoading: loadingMembers } = useCompanyMembers(company?.id);
  const {
    updateRole,
    updateCapacity,
    updateWorkingWeekdays,
    updateRemPartner,
    updateRemMaxPercent,
    error: roleError,
  } = useCompanyMemberMutations();

  if (!company) return <Redirect href="/settings" />;

  return (
    <StackScreen title={t('tabs.settings.members')} onBack={() => router.back()}>
      <View style={styles.wrap}>
        {manager && user?.id ? (
          <TitledCard title={t('tabs.settings.inviteTeammates')}>
            <InvitesCard companyId={company.id} invitedBy={user.id} canGrantElevated={isAdmin} />
          </TitledCard>
        ) : null}

        <TitledCard title={t('tabs.settings.members')}>
          {loadingMembers && members == null ? (
            <ScreenLoader fill={false} />
          ) : (members ?? []).length === 0 ? (
            <EmptyState
              icon="people-outline"
              title={t('tabs.settings.noMembers')}
              subtitle={t('tabs.settings.noMembersSubtitle')}
            />
          ) : (
            (members ?? []).map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                canEdit={
                  manager && member.user_id !== user?.id && (member.role !== 'admin' || isAdmin)
                }
                canGrantAdmin={isAdmin}
                onRoleChange={(next: AppRole) => updateRole(member.id, next)}
                onCapacityChange={(days) => updateCapacity(member.id, days)}
                companyDefaultWeekdays={company.working_weekdays ?? DEFAULT_WORKING_WEEKDAYS}
                onWorkingWeekdaysChange={(weekdays) => updateWorkingWeekdays(member.id, weekdays)}
                onRemPartnerChange={(next) => updateRemPartner(member.id, next)}
                onRemMaxPercentChange={(next) => updateRemMaxPercent(member.id, next)}
              />
            ))
          )}
          {roleError ? (
            <InlineError error={roleError} describe={{ fallback: t('tabs.settings.roleChangeFailed') }} />
          ) : null}
        </TitledCard>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
});
