import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { EmptyState, StackScreen, TitledCard, spacing } from '@chrono/ui';
import { DEFAULT_WORKING_WEEKDAYS, canManage, displayName } from '@chrono/sdk';
import type { AppRole, CompanyMemberWithProfile } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useCompanyMembers, useCompanyMemberMutations } from '@/lib/hooks/use-company-members';
import { MemberRow } from '@/components/settings/MemberRow';
import { InvitesCard } from '@/components/settings/InvitesCard';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { InlineError } from '@/components/common/ErrorState';

const ROLE_ORDER: Record<AppRole, number> = {
  admin: 0,
  manager: 1,
  freelancer: 2,
};

function sortMembers(members: CompanyMemberWithProfile[]): CompanyMemberWithProfile[] {
  return [...members].sort((a, b) => {
    const byRole = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
    if (byRole !== 0) return byRole;
    return displayName(a.profile).localeCompare(displayName(b.profile), undefined, {
      sensitivity: 'base',
    });
  });
}

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
    updateRemLicenseRecipient,
    updateRemMaxPercent,
    remove,
    isPending: removingMember,
    error: roleError,
  } = useCompanyMemberMutations();

  const sortedMembers = useMemo(() => sortMembers(members ?? []), [members]);

  if (!company) return <Redirect href="/settings" />;

  return (
    <StackScreen title={t('tabs.settings.members')} onBack={() => router.back()}>
      <View style={styles.wrap}>
        <TitledCard
          title={t('tabs.settings.members')}
          subtitle={
            members == null
              ? undefined
              : t('tabs.settings.memberCount', { n: members.length })
          }
        >
          {loadingMembers && members == null ? (
            <ScreenLoader fill={false} />
          ) : sortedMembers.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title={t('tabs.settings.noMembers')}
              subtitle={t('tabs.settings.noMembersSubtitle')}
            />
          ) : (
            <View style={styles.roster}>
              {sortedMembers.map((member, index) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isLast={index === sortedMembers.length - 1}
                  canEdit={
                    manager && member.user_id !== user?.id && (member.role !== 'admin' || isAdmin)
                  }
                  canGrantAdmin={isAdmin}
                  onRoleChange={(next: AppRole) => updateRole(member.id, next)}
                  onCapacityChange={(days) => updateCapacity(member.id, days)}
                  companyDefaultWeekdays={company.working_weekdays ?? DEFAULT_WORKING_WEEKDAYS}
                  onWorkingWeekdaysChange={(weekdays) => updateWorkingWeekdays(member.id, weekdays)}
                  onRemPartnerChange={(next) => updateRemPartner(member.id, next)}
                  onRemLicenseRecipientChange={(next) => updateRemLicenseRecipient(member.id, next)}
                  onRemMaxPercentChange={(next) => updateRemMaxPercent(member.id, next)}
                  onRemove={() => void remove(member.id)}
                  removing={removingMember}
                />
              ))}
            </View>
          )}
          {roleError ? (
            <InlineError
              error={roleError}
              describe={{ fallback: t('tabs.settings.memberActionFailed') }}
            />
          ) : null}
        </TitledCard>

        {manager && user?.id ? (
          <TitledCard
            title={t('tabs.settings.inviteTeammates')}
            subtitle={t('tabs.settings.inviteTeammatesHint')}
          >
            <InvitesCard companyId={company.id} invitedBy={user.id} canGrantElevated={isAdmin} />
          </TitledCard>
        ) : null}
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  roster: { marginHorizontal: -spacing.xs },
});
