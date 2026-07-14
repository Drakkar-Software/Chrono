import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Segmented, TextField, Txt } from '@chrono/ui';

import { useAppAuth } from '@/lib/supabase-stores';
import { useProfileMutations } from '@/lib/hooks/use-profile';
import { useCompanyMutations } from '@/lib/hooks/use-companies';
import { useJoinCompany } from '@/lib/hooks/use-company-members';
import { useActiveCompany } from '@/lib/active-company-context';
import { AuthCard } from '@/components/common/AuthCard';
import { useT } from '@/lib/i18n';

type Mode = 'create' | 'join';

/**
 * First-run setup: capture the user's name and either create their first
 * company (the DB trigger makes the creator an admin member) or join an
 * existing one with its join code (id), landing them in as a freelancer.
 */
export default function RoleSetup() {
  const t = useT();
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
      setError(t('onboarding.role.errName'));
      return;
    }
    if (mode === 'create' && !companyName.trim()) {
      setError(t('onboarding.role.errCompanyName'));
      return;
    }
    if (mode === 'join' && !code.trim()) {
      setError(t('onboarding.role.errCompanyCode'));
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
            setError(t('onboarding.role.errJoin'));
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
      setError(e instanceof Error ? e.message : t('onboarding.role.errGeneric'));
      setBusy(false);
    }
  };

  const joining = mode === 'join';

  return (
    <AuthCard
      title={t('onboarding.role.title')}
      subtitle={
        joining
          ? t('onboarding.role.subtitleJoin')
          : t('onboarding.role.subtitleCreate')
      }
    >
      <Segmented
        value={mode}
        onValueChange={(v) => {
          setMode(v as Mode);
          setError(undefined);
        }}
        options={[
          { label: t('onboarding.role.optCreate'), value: 'create' },
          { label: t('onboarding.role.optJoin'), value: 'join' },
        ]}
        disabled={busy}
      />
      <TextField
        label={t('onboarding.role.nameLabel')}
        value={fullName}
        onChangeText={setFullName}
        placeholder={t('onboarding.role.namePlaceholder')}
      />
      {joining ? (
        <TextField
          label={t('onboarding.role.codeLabel')}
          value={code}
          onChangeText={setCode}
          placeholder={t('onboarding.role.codePlaceholder')}
          autoCapitalize="none"
        />
      ) : (
        <TextField
          label={t('onboarding.role.companyLabel')}
          value={companyName}
          onChangeText={setCompanyName}
          placeholder={t('onboarding.role.companyPlaceholder')}
        />
      )}
      {error ? (
        <Txt variant="caption" tone="danger" center>
          {error}
        </Txt>
      ) : null}
      <Button
        title={joining ? t('onboarding.role.joinBtn') : t('onboarding.role.createBtn')}
        onPress={submit}
        loading={busy}
        fullWidth
      />
    </AuthCard>
  );
}
