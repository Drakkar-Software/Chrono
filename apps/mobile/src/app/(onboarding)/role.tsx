import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Segmented, TextField, Txt } from '@chrono/ui';

import { useAppAuth } from '@/lib/supabase-stores';
import { useProfileMutations } from '@/lib/hooks/use-profile';
import { useCompanyMutations } from '@/lib/hooks/use-companies';
import { useJoinCompany } from '@/lib/hooks/use-company-members';
import { useActiveCompany } from '@/lib/active-company-context';
import { AuthCard } from '@/components/common/AuthCard';

type Mode = 'create' | 'join';

/**
 * First-run setup: capture the user's name and either create their first
 * company (the DB trigger makes the creator an admin member) or join an
 * existing one with its join code (id), landing them in as a freelancer.
 */
export default function RoleSetup() {
  const router = useRouter();
  const { user } = useAppAuth();
  const { completeOnboarding } = useProfileMutations();
  const { create } = useCompanyMutations();
  const { mutateAsync: joinCompany } = useJoinCompany();
  const { refresh } = useActiveCompany();

  const [mode, setMode] = useState<Mode>('create');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async () => {
    if (!user?.id) return;
    if (!fullName.trim()) {
      setError('Enter your name');
      return;
    }
    if (mode === 'create' && !companyName.trim()) {
      setError('Enter a company name');
      return;
    }
    if (mode === 'join' && !code.trim()) {
      setError('Enter a company code');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'join') {
        try {
          await joinCompany({ companyId: code.trim(), userId: user.id });
        } catch (joinErr) {
          // A duplicate-membership error means the user is already in this
          // company (e.g. a prior attempt joined but onboarding then failed, or a
          // manager pre-added them) — treat that as success and finish onboarding.
          const msg = joinErr instanceof Error ? joinErr.message : String(joinErr);
          const alreadyMember = /duplicate|23505|already exists/i.test(msg);
          if (!alreadyMember) {
            setError("Couldn't join — check the code and try again.");
            setBusy(false);
            return;
          }
        }
        await completeOnboarding(user.id, fullName.trim());
      } else {
        await completeOnboarding(user.id, fullName.trim());
        await create({ content: { name: companyName.trim() }, created_by: user.id });
      }
      await refresh();
      router.replace('/(app)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  const joining = mode === 'join';

  return (
    <AuthCard
      title="Set up Chrono"
      subtitle={
        joining
          ? 'Step 1 of 1 · Enter your name and the code your team shared to join.'
          : 'Step 1 of 1 · Tell us who you are and name your company to get started.'
      }
    >
      <Segmented
        value={mode}
        onValueChange={(v) => {
          setMode(v as Mode);
          setError(undefined);
        }}
        options={[
          { label: 'Create a company', value: 'create' },
          { label: 'Join with a code', value: 'join' },
        ]}
        disabled={busy}
      />
      <TextField label="Your name" value={fullName} onChangeText={setFullName} placeholder="Jane Doe" />
      {joining ? (
        <TextField
          label="Company code"
          value={code}
          onChangeText={setCode}
          placeholder="Paste the code from your manager"
          autoCapitalize="none"
        />
      ) : (
        <TextField
          label="Company name"
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="Acme Studio"
        />
      )}
      {error ? (
        <Txt variant="caption" tone="danger" center>
          {error}
        </Txt>
      ) : null}
      <Button
        title={joining ? 'Join company' : 'Create company'}
        onPress={submit}
        loading={busy}
        fullWidth
      />
    </AuthCard>
  );
}
