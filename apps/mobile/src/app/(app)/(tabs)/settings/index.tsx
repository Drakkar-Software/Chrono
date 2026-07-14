import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Picker, StackScreen, TextField, Txt, spacing } from '@chrono/ui';
import { canManage, companyName } from '@chrono/sdk';
import type { AppRole } from '@chrono/sdk';

import { useAppAuth } from '@/lib/supabase-stores';
import { useActiveCompany } from '@/lib/active-company-context';
import { useProfile, useProfileMutations } from '@/lib/hooks/use-profile';
import { useCompanyMembers, useCompanyMemberMutations } from '@/lib/hooks/use-company-members';
import { MemberRow } from '@/components/settings/MemberRow';

export default function SettingsScreen() {
  const { user, signOut } = useAppAuth();
  const { companyId, company, companies, role, setCompanyId } = useActiveCompany();
  const manager = canManage(role);

  const { data: profile } = useProfile();
  const { updateProfile, isPending: savingProfile } = useProfileMutations();
  const { data: members } = useCompanyMembers(companyId ?? undefined);
  const { updateRole } = useCompanyMemberMutations();

  const [name, setName] = useState('');
  useEffect(() => {
    setName(profile?.full_name ?? '');
  }, [profile?.full_name]);

  const saveName = () => {
    if (user?.id && name.trim()) updateProfile(user.id, { full_name: name.trim() });
  };

  return (
    <StackScreen title="Settings">
      <View style={styles.wrap}>
        <Card padding="lg" style={styles.card}>
          <Txt variant="heading">Profile</Txt>
          <TextField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <Button title="Save" onPress={saveName} loading={savingProfile} disabled={!name.trim()} />
        </Card>

        {companies.length > 0 ? (
          <Card padding="lg" style={styles.card}>
            <Txt variant="heading">Active company</Txt>
            <Picker
              value={companyId ?? ''}
              onValueChange={setCompanyId}
              options={companies.map((c) => ({ label: companyName(c), value: c.id }))}
            />
          </Card>
        ) : null}

        <Card padding="lg" style={styles.card}>
          <Txt variant="heading">Members</Txt>
          {(members ?? []).length === 0 ? (
            <Txt variant="body" tone="textMuted">
              No members yet.
            </Txt>
          ) : (
            (members ?? []).map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                canEdit={manager}
                onRoleChange={(next: AppRole) => updateRole(member.id, next)}
              />
            ))
          )}
        </Card>

        <Button title="Sign out" variant="danger" onPress={() => signOut()} fullWidth />
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  card: { gap: spacing.md },
});
