import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Segmented, TextField, Txt } from '@chrono/ui';

import { useAppAuth } from '@/lib/supabase-stores';
import { useProfileMutations } from '@/lib/hooks/use-profile';
import { useCompanyMutations } from '@/lib/hooks/use-companies';
import { useInviteMutations } from '@/lib/hooks/use-invites';
import { classifyInviteError, fetchMyCompanies, tokenFromInput } from '@chrono/sdk';
import type { InviteErrorKind } from '@chrono/sdk';
import { globalSupabaseClient } from '@/lib/supabase';
import { useActiveCompany } from '@/lib/active-company-context';
import { AuthCard } from '@/components/common/AuthCard';
import { useT } from '@/lib/i18n';

function inviteJoinError(kind: InviteErrorKind | null, t: ReturnType<typeof useT>): string {
  switch (kind) {
    case 'not_found':
      return t('compb.join.errNotFound');
    case 'revoked':
      return t('compb.join.errRevoked');
    case 'used':
      return t('compb.join.errUsed');
    case 'expired':
      return t('compb.join.errExpired');
    case 'unsigned':
      return t('compb.join.errUnsigned');
    case 'seat_limit':
      return t('compb.join.errSeatLimit');
    case 'admin_role':
    case 'permission':
      return t('compb.join.errPermission');
    default:
      return t('onboarding.role.errJoin');
  }
}

type Mode = 'create' | 'join';

/**
 * First-run setup: capture the user's name and either create their first
 * company (the DB trigger makes the creator an admin member) or join an
 * existing one by redeeming an invite token (or a pasted invite link), which
 * lands them in at the role the invite was issued for.
 */
export default function RoleSetup() {
  const t = useT();
  const router = useRouter();
  const { user } = useAppAuth();
  const { completeOnboarding } = useProfileMutations();
  const { create } = useCompanyMutations();
  const { accept } = useInviteMutations();
  const { refresh, setCompanyId } = useActiveCompany();

  const [mode, setMode] = useState<Mode>('create');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const finish = async (activeCompanyId?: string) => {
    await refresh();
    if (activeCompanyId) setCompanyId(activeCompanyId);
    router.replace('/(app)/(tabs)/home');
  };

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
    const token = tokenFromInput(code);
    if (mode === 'join' && !token) {
      setError(t('onboarding.role.errCompanyCode'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'join') {
        // Join only by redeeming an invite token (accept_company_invite validates
        // the token server-side). Self-joining an arbitrary company is not allowed.
        let companyId: string | undefined;
        try {
          companyId = await accept(token);
        } catch (e) {
          // Invite already consumed (e.g. PendingInviteRedeemer or a prior
          // accept that bounced on the onboarded gate): if this user is already
          // a member, finish onboarding instead of blocking on "used".
          if (classifyInviteError(e) === 'used') {
            const memberships = await fetchMyCompanies(globalSupabaseClient, user.id);
            companyId = memberships[0]?.id;
          }
          if (!companyId) {
            setError(inviteJoinError(classifyInviteError(e), t));
            setBusy(false);
            return;
          }
        }
        await completeOnboarding(user.id, fullName.trim());
        await finish(companyId);
      } else {
        await completeOnboarding(user.id, fullName.trim());
        await create({
          content: { name: companyName.trim() },
          created_by: user.id,
        });
        await finish();
      }
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
