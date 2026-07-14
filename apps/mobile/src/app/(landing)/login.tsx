import { useState } from 'react';
import { Link } from 'expo-router';
import { Txt } from '@chrono/ui';
import { AuthForm } from '@/components/auth/AuthForm';
import { globalSupabaseClient } from '@/lib/supabase';
import { authErrorKey } from '@/lib/auth-utils';
import { useT } from '@/lib/i18n';

export default function Login() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const signIn = async (email: string, password: string) => {
    setBusy(true);
    setError(undefined);
    const { error: authError } = await globalSupabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (authError) setError(t(authErrorKey(authError)));
  };

  return (
    <AuthForm
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      submitLabel={t('auth.signIn')}
      onSubmit={signIn}
      busy={busy}
      error={error}
      footer={
        <>
          <Link href="/(landing)/register">
            <Txt variant="caption" tone="accent">
              {t('auth.login.createAccount')}
            </Txt>
          </Link>
          <Link href="/(landing)/reset-password">
            <Txt variant="caption" tone="textMuted">
              {t('auth.login.forgotPassword')}
            </Txt>
          </Link>
        </>
      }
    />
  );
}
