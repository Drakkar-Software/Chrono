import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, EmptyState, Picker, Row, StackScreen, TextField, Txt, spacing, useResponsive } from '@chrono/ui';
import { canManage, companyName } from '@chrono/sdk';
import type { AppRole } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useProfile, useProfileMutations } from '@/lib/hooks/use-profile';
import { useCompanyMembers, useCompanyMemberMutations } from '@/lib/hooks/use-company-members';
import { MemberRow } from '@/components/settings/MemberRow';
import { AvatarUpload } from '@/components/settings/AvatarUpload';
import { ThemeToggle } from '@/components/settings/ThemeToggle';
import { LanguageToggle } from '@/components/settings/LanguageToggle';
import { EditCompanyForm } from '@/components/settings/EditCompanyForm';
import { JoinCompanyForm } from '@/components/settings/JoinCompanyForm';
import { InvitesCard } from '@/components/settings/InvitesCard';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { InlineError } from '@/components/common/ErrorState';

export default function SettingsScreen() {
  const t = useT();
  const { isWide } = useResponsive();
  const { user, signOut } = useAppAuth();
  const { companyId, company, companies, role, setCompanyId, refresh } = useActiveCompany();
  const manager = canManage(role);
  const isAdmin = role === 'admin';

  const { data: profile } = useProfile();
  const { updateProfile, isPending: savingProfile } = useProfileMutations();
  const { data: members, isLoading: loadingMembers } = useCompanyMembers(companyId ?? undefined);
  const { updateRole, error: roleError } = useCompanyMemberMutations();

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
    setAddress(profile?.address ?? '');
    setVatId(profile?.vat_id ?? '');
    setBusinessId(profile?.business_id ?? '');
  }, [profile?.full_name, profile?.address, profile?.vat_id, profile?.business_id]);

  const saveName = () => {
    if (!user?.id || !name.trim()) return;
    updateProfile(user.id, {
      full_name: name.trim(),
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
  const topColStyle = isWide ? styles.colWide : styles.colFull;

  return (
    <StackScreen title={t('tabs.nav.settings')}>
      <View style={styles.wrap}>
        <View style={[styles.grid, isWide && styles.gridRow]}>
          <View style={topColStyle}>
            <Card padding="lg" style={styles.card}>
              <Txt variant="heading">{t('tabs.settings.profile')}</Txt>
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
              <Button title={t('common.save')} onPress={saveName} loading={savingProfile} disabled={!name.trim()} fullWidth={!isWide} />
            </Card>
          </View>

          <View style={topColStyle}>
            <Card padding="lg" style={styles.card}>
              <Txt variant="heading">{t('tabs.settings.appearance')}</Txt>
              <ThemeToggle />
              <Txt variant="caption" tone="textMuted">
                {t('tabs.settings.appearanceHint')}
              </Txt>
              <LanguageToggle />
              <Txt variant="caption" tone="textMuted">
                {t('tabs.settings.languageHint')}
              </Txt>
            </Card>
          </View>
        </View>

        {hasCompanies ? (
          <Card padding="lg" style={styles.card}>
            <Txt variant="heading">{t('tabs.settings.activeCompany')}</Txt>
            <Picker
              value={companyId ?? ''}
              onValueChange={setCompanyId}
              options={companies.map((c) => ({ label: companyName(c), value: c.id }))}
            />
            <Txt variant="caption" tone="textMuted">
              {t('tabs.settings.activeCompanyHint')}
            </Txt>
          </Card>
        ) : null}

        {company ? (
          <Card padding="lg" style={styles.card}>
            <Txt variant="heading">{t('tabs.settings.company')}</Txt>
            {isAdmin ? (
              <EditCompanyForm company={company} onSaved={refresh} />
            ) : (
              <Row label={t('tabs.settings.name')} value={companyName(company)} />
            )}
          </Card>
        ) : null}

        {manager && company && user?.id ? (
          <Card padding="lg" style={styles.card}>
            <Txt variant="heading">{t('tabs.settings.inviteTeammates')}</Txt>
            <InvitesCard companyId={company.id} invitedBy={user.id} canGrantElevated={isAdmin} />
          </Card>
        ) : null}

        <Card padding="lg" style={styles.card}>
          <Txt variant="heading">{t('tabs.settings.joinCompany')}</Txt>
          <JoinCompanyForm userId={user?.id} onJoined={onJoined} />
          <Txt variant="caption" tone="textMuted">
            {t('tabs.settings.joinCompanyHint')}
          </Txt>
        </Card>

        <Card padding="lg" style={styles.card}>
          <Txt variant="heading">{t('tabs.settings.members')}</Txt>
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
              />
            ))
          )}
          {roleError ? <InlineError error={roleError} describe={{ fallback: t('tabs.settings.roleChangeFailed') }} /> : null}
        </Card>

        <Button title={t('common.signOut')} variant="danger" onPress={() => signOut()} fullWidth={!isWide} />
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  grid: { gap: spacing.lg },
  gridRow: { flexDirection: 'row', alignItems: 'flex-start' },
  colWide: { flex: 1 },
  colFull: { width: '100%' },
  card: { gap: spacing.md },
});
