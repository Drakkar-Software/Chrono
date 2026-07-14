import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, EmptyState, Picker, Row, StackScreen, TextField, Txt, spacing, useResponsive } from '@chrono/ui';
import { canManage, companyName } from '@chrono/sdk';
import type { AppRole } from '@chrono/sdk';

import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useProfile, useProfileMutations } from '@/lib/hooks/use-profile';
import { useCompanyMembers, useCompanyMemberMutations } from '@/lib/hooks/use-company-members';
import { MemberRow } from '@/components/settings/MemberRow';
import { AvatarUpload } from '@/components/settings/AvatarUpload';
import { ThemeToggle } from '@/components/settings/ThemeToggle';
import { EditCompanyForm } from '@/components/settings/EditCompanyForm';
import { JoinCompanyForm } from '@/components/settings/JoinCompanyForm';
import { ScreenLoader } from '@/components/common/ScreenLoader';

export default function SettingsScreen() {
  const { isWide } = useResponsive();
  const { user, signOut } = useAppAuth();
  const { companyId, company, companies, role, setCompanyId, refresh } = useActiveCompany();
  const manager = canManage(role);
  const isAdmin = role === 'admin';

  const { data: profile } = useProfile();
  const { updateProfile, isPending: savingProfile } = useProfileMutations();
  const { data: members, isLoading: loadingMembers } = useCompanyMembers(companyId ?? undefined);
  const { updateRole } = useCompanyMemberMutations();

  // Seed the editable name field once the profile loads asynchronously, while
  // still letting the user type over it. This intentional prop->state sync is a
  // legitimate effect (the value arrives after first render).
  const [name, setName] = useState('');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop->state sync of an async-loaded value
    setName(profile?.full_name ?? '');
  }, [profile?.full_name]);

  const saveName = () => {
    if (user?.id && name.trim()) updateProfile(user.id, { full_name: name.trim() });
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
    <StackScreen title="Settings">
      <View style={styles.wrap}>
        <View style={[styles.grid, isWide && styles.gridRow]}>
          <View style={topColStyle}>
            <Card padding="lg" style={styles.card}>
              <Txt variant="heading">Profile</Txt>
              <AvatarUpload
                imageUrl={profile?.avatar_url}
                name={name || profile?.full_name}
                bucket="avatars"
                folder={user?.id ?? ''}
                onUploaded={onAvatarUploaded}
              />
              <TextField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
              {user?.email ? (
                <Txt variant="caption" tone="textMuted">
                  {user.email}
                </Txt>
              ) : null}
              <Button title="Save" onPress={saveName} loading={savingProfile} disabled={!name.trim()} fullWidth={!isWide} />
            </Card>
          </View>

          <View style={topColStyle}>
            <Card padding="lg" style={styles.card}>
              <Txt variant="heading">Appearance</Txt>
              <ThemeToggle />
              <Txt variant="caption" tone="textMuted">
                Choose a light or dark theme, or follow your device.
              </Txt>
            </Card>
          </View>
        </View>

        {hasCompanies ? (
          <Card padding="lg" style={styles.card}>
            <Txt variant="heading">Active company</Txt>
            <Picker
              value={companyId ?? ''}
              onValueChange={setCompanyId}
              options={companies.map((c) => ({ label: companyName(c), value: c.id }))}
            />
            <Txt variant="caption" tone="textMuted">
              Switch between the teams you work with.
            </Txt>
          </Card>
        ) : null}

        {company ? (
          <Card padding="lg" style={styles.card}>
            <Txt variant="heading">Company</Txt>
            {isAdmin ? (
              <EditCompanyForm company={company} onSaved={refresh} />
            ) : (
              <Row label="Name" value={companyName(company)} />
            )}
          </Card>
        ) : null}

        {manager && company ? (
          <Card padding="lg" style={styles.card}>
            <Txt variant="heading">Invite teammates</Txt>
            <Row label="Join code">
              <Txt variant="bodyMedium" mono>
                {company.id}
              </Txt>
            </Row>
            <Txt variant="caption" tone="textMuted">
              Share this code — teammates enter it at sign-up to join as freelancers, then you can
              promote them here.
            </Txt>
          </Card>
        ) : null}

        <Card padding="lg" style={styles.card}>
          <Txt variant="heading">Join a company</Txt>
          <JoinCompanyForm userId={user?.id} onJoined={onJoined} />
          <Txt variant="caption" tone="textMuted">
            Have a company code? Paste it here to join another team.
          </Txt>
        </Card>

        <Card padding="lg" style={styles.card}>
          <Txt variant="heading">Members</Txt>
          {loadingMembers && members == null ? (
            <ScreenLoader fill={false} />
          ) : (members ?? []).length === 0 ? (
            <EmptyState icon="people-outline" title="No members yet" subtitle="Invite teammates to this company to see them here." />
          ) : (
            (members ?? []).map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                canEdit={manager}
                canGrantAdmin={role === 'admin'}
                onRoleChange={(next: AppRole) => updateRole(member.id, next)}
              />
            ))
          )}
        </Card>

        <Button title="Sign out" variant="danger" onPress={() => signOut()} fullWidth={!isWide} />
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
