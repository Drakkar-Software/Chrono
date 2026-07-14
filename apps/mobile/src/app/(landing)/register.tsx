import { useState } from 'react';
import { Platform } from 'react-native';
import { Link } from 'expo-router';
import { Txt } from '@chrono/ui';
import { AuthForm } from '@/components/auth/AuthForm';
import { authErrorKey, signUpWithOptions } from '@/lib/auth-utils';
import { useT } from '@/lib/i18n';

export default function Register() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  const signUp = async (email: string, password: string) => {
    setBusy(true);
    setError(undefined);
    const { data, error: authError } = await signUpWithOptions(email, password, {
      data: { registeredFrom: Platform.OS },
    });
    setBusy(false);
    if (authError) {
      setError(t(authErrorKey(authError)));
      return;
    }
    // With email confirmations ON, Supabase returns a user with an EMPTY
    // `identities` array when the email already exists (to avoid leaking which
    // emails are registered). Treat that as "already registered".
    if (data?.user && (data.user.identities?.length ?? 0) === 0) {
      setError(t('auth.errors.user_already_exists'));
      return;
    }
    // When confirmations are ON, no session comes back and the user must confirm
    // via email. When they're OFF, a session is returned and the auth-state
    // listener redirects into the app — no inbox prompt needed.
    if (!data?.session) setDone(true);
  };

  return (
    <AuthForm
      title={t('auth.createAccount')}
      subtitle={done ? t('auth.register.checkInbox') : t('auth.register.subtitle')}
      submitLabel={t('auth.signUp')}
      onSubmit={signUp}
      withConfirm
      busy={busy}
      error={error}
      footer={
        <Link href="/(landing)/login">
          <Txt variant="caption" tone="accent">
            {t('auth.register.haveAccount')}
          </Txt>
        </Link>
      }
    />
  );
}
