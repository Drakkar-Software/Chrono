import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, ListItem, Picker, StackScreen, TextField, TitledCard, Txt, spacing, useResponsive } from '@chrono/ui';
import { DEFAULT_WORKING_WEEKDAYS, canManage, companyName } from '@chrono/sdk';
import type { AppRole } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import {
  useProfile,
  useProfileMutations,
  useProfileBilling,
  useProfileBillingMutations,
} from '@/lib/hooks/use-profile';
import { useCompanyMembers, useCompanyMemberMutations } from '@/lib/hooks/use-company-members';
import { MemberRow } from '@/components/settings/MemberRow';
import { AvatarUpload } from '@/components/settings/AvatarUpload';
import { ThemeToggle } from '@/components/settings/ThemeToggle';
import { LanguageToggle } from '@/components/settings/LanguageToggle';
import { JoinCompanyForm } from '@/components/settings/JoinCompanyForm';
import { InvitesCard } from '@/components/settings/InvitesCard';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { InlineError } from '@/components/common/ErrorState';

export default function SettingsScreen() {
  const t = useT();
  const router = useRouter();
  const { isWide } = useResponsive();
  const { user, signOut } = useAppAuth();
  const { companyId, company, companies, role, setCompanyId, refresh } = useActiveCompany();
  const manager = canManage(role);
  const isAdmin = role === 'admin';

  const { data: profile } = useProfile();
  const { updateProfile, isPending: savingProfile } = useProfileMutations();
  const { data: billing } = useProfileBilling();
  const { saveBilling, isPending: savingBilling } = useProfileBillingMutations();
  const { data: members, isLoading: loadingMembers } = useCompanyMembers(companyId ?? undefined);
  const { updateRole, updateCapacity, updateWorkingWeekdays, error: roleError } = useCompanyMemberMutations();

  // Seed the editable name field once the profile loads asynchronously, while
  // still letting the user type over it. This intentional prop->state sync is a
  // legitimate effect (the value arrives after first render).
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [vatId, setVatId] = useState('');
  const [businessId, setBusinessId] = useState('');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop->state sync of async-loaded values
    setName(profile?.full_name ?? '');
  }, [profile?.full_name]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop->state sync of async-loaded values
    setAddress(billing?.address ?? '');
    setVatId(billing?.vat_id ?? '');
    setBusinessId(billing?.business_id ?? '');
  }, [billing?.address, billing?.vat_id, billing?.business_id]);

  const saveName = () => {
    if (!user?.id || !name.trim()) return;
    updateProfile(user.id, { full_name: name.trim() });
    saveBilling(user.id, {
      address: address.trim() || null,
      vat_id: vatId.trim() || null,
      business_id: businessId.trim() || null,
    });
  };

  const onAvatarUploaded = async (url: string) => {
    if (user?.id) await updateProfile(user.id, { avatar_url: url });
  };

  const onJoined = async (joinedId: string) => {
    await refresh();
    setCompanyId(joinedId);
  };

  const hasCompanies = companies.length > 0;

  return (
    <StackScreen title={t('tabs.nav.settings')}>
      <View style={styles.wrap}>
        <View style={styles.grid}>
          <View style={styles.colFull}>
            <TitledCard title={t('tabs.settings.profile')}>
              <AvatarUpload
                imageUrl={profile?.avatar_url}
                name={name || profile?.full_name}
                bucket="avatars"
                folder={user?.id ?? ''}
                onUploaded={onAvatarUploaded}
              />
              <TextField label={t('tabs.settings.name')} value={name} onChangeText={setName} placeholder={t('tabs.settings.namePlaceholder')} />
              {user?.email ? (
                <Txt variant="caption" tone="textMuted">
                  {user.email}
                </Txt>
              ) : null}
              <TextField
                label={t('tabs.settings.address')}
                value={address}
                onChangeText={setAddress}
                placeholder={t('tabs.settings.addressPlaceholder')}
                multiline
              />
              <TextField label={t('tabs.settings.vat')} value={vatId} onChangeText={setVatId} placeholder={t('tabs.settings.vatPlaceholder')} />
              <TextField
                label={t('tabs.settings.businessId')}
                value={businessId}
                onChangeText={setBusinessId}
                placeholder={t('tabs.settings.businessIdPlaceholder')}
              />
              <Txt variant="caption" tone="textMuted">
                {t('tabs.settings.invoiceInfo')}
              </Txt>
              <Button title={t('common.save')} onPress={saveName} loading={savingProfile || savingBilling} disabled={!name.trim()} fullWidth={!isWide} />
            </TitledCard>
          </View>

          <View style={styles.colFull}>
            <TitledCard title={t('tabs.settings.appearance')}>
              <ThemeToggle />
              <Txt variant="caption" tone="textMuted">
                {t('tabs.settings.appearanceHint')}
              </Txt>
              <LanguageToggle />
              <Txt variant="caption" tone="textMuted">
                {t('tabs.settings.languageHint')}
              </Txt>
            </TitledCard>
          </View>
        </View>

        {hasCompanies ? (
          <TitledCard title={t('tabs.settings.activeCompany')}>
            <Picker
              value={companyId ?? ''}
              onValueChange={setCompanyId}
              options={companies.map((c) => ({ label: companyName(c), value: c.id }))}
            />
            <Txt variant="caption" tone="textMuted">
              {t('tabs.settings.activeCompanyHint')}
            </Txt>
          </TitledCard>
        ) : null}

        {company ? (
          <Card padding="none">
            <ListItem
              title={t('tabs.settings.company')}
              subtitle={t('tabs.settings.companyNavHint')}
              onPress={() => router.push('/settings/enterprise')}
              divider={manager}
            />
            {manager ? (
              <ListItem
                title={t('tabs.settings.workingDaysAndHolidays')}
                subtitle={t('tabs.settings.workingDaysNavHint')}
                onPress={() => router.push('/settings/working-days')}
                divider={false}
              />
            ) : null}
          </Card>
        ) : null}

        {manager && company && user?.id ? (
          <TitledCard title={t('tabs.settings.inviteTeammates')}>
            <InvitesCard companyId={company.id} invitedBy={user.id} canGrantElevated={isAdmin} />
          </TitledCard>
        ) : null}

        <TitledCard title={t('tabs.settings.joinCompany')}>
          <JoinCompanyForm userId={user?.id} onJoined={onJoined} />
          <Txt variant="caption" tone="textMuted">
            {t('tabs.settings.joinCompanyHint')}
          </Txt>
        </TitledCard>

        <TitledCard title={t('tabs.settings.members')}>
          {loadingMembers && members == null ? (
            <ScreenLoader fill={false} />
          ) : (members ?? []).length === 0 ? (
            <EmptyState icon="people-outline" title={t('tabs.settings.noMembers')} subtitle={t('tabs.settings.noMembersSubtitle')} />
          ) : (
            (members ?? []).map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                // Managers can edit others' non-admin roles; only admins may
                // change an admin's role. Nobody edits their own role here —
                // all three are enforced by triggers, so gate the UI to match.
                canEdit={
                  manager && member.user_id !== user?.id && (member.role !== 'admin' || isAdmin)
                }
                canGrantAdmin={isAdmin}
                onRoleChange={(next: AppRole) => updateRole(member.id, next)}
                onCapacityChange={(days) => updateCapacity(member.id, days)}
                companyDefaultWeekdays={company?.working_weekdays ?? DEFAULT_WORKING_WEEKDAYS}
                onWorkingWeekdaysChange={(weekdays) => updateWorkingWeekdays(member.id, weekdays)}
              />
            ))
          )}
          {roleError ? <InlineError error={roleError} describe={{ fallback: t('tabs.settings.roleChangeFailed') }} /> : null}
        </TitledCard>

        <Button title={t('common.signOut')} variant="danger" onPress={() => signOut()} fullWidth={!isWide} />
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  grid: { gap: spacing.lg },
  colFull: { width: '100%' },
});
