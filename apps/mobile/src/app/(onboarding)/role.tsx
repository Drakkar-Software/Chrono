import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, TextField, Txt } from '@chrono/ui';

import { useAppAuth } from '@/lib/supabase-stores';
import { useProfileMutations } from '@/lib/hooks/use-profile';
import { useCompanyMutations } from '@/lib/hooks/use-companies';
import { useActiveCompany } from '@/lib/active-company-context';
import { AuthCard } from '@/components/common/AuthCard';

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
    <AuthCard
      title="Set up Chrono"
      subtitle="Step 1 of 1 · Tell us who you are and name your company to get started."
    >
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
    </AuthCard>
  );
}
