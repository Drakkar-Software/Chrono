import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Screen, TextField, Txt, spacing } from '@chrono/ui';

import { useAppAuth } from '@/lib/supabase-stores';
import { useProfileMutations } from '@/lib/hooks/use-profile';
import { useCompanyMutations } from '@/lib/hooks/use-companies';
import { useActiveCompany } from '@/lib/active-company-context';

/**
 * First-run setup: capture the user's name and create their first company. The
 * DB trigger makes the creator an admin member.
 */
export default function RoleSetup() {
  const router = useRouter();
  const { user } = useAppAuth();
  const { completeOnboarding } = useProfileMutations();
  const { create } = useCompanyMutations();
  const { refresh } = useActiveCompany();

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async () => {
    if (!user?.id) return;
    if (!fullName.trim()) {
      setError('Enter your name');
      return;
    }
    if (!companyName.trim()) {
      setError('Enter a company name');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await completeOnboarding(user.id, fullName.trim());
      await create({ content: { name: companyName.trim() }, created_by: user.id });
      await refresh();
      router.replace('/(app)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.wrap}>
        <Card padding="xl" style={styles.card}>
          <Txt variant="title" center>
            Set up Chrono
          </Txt>
          <Txt variant="body" tone="textMuted" center>
            Tell us who you are and name your company to get started.
          </Txt>
          <TextField label="Your name" value={fullName} onChangeText={setFullName} placeholder="Jane Doe" />
          <TextField
            label="Company name"
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="Acme Studio"
          />
          {error ? (
            <Txt variant="caption" tone="danger" center>
              {error}
            </Txt>
          ) : null}
          <Button title="Create company" onPress={submit} loading={busy} fullWidth />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  card: { gap: spacing.md, width: '100%', maxWidth: 420, alignSelf: 'center' },
});
