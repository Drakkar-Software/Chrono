import { useState } from 'react';
import { Platform } from 'react-native';
import { Link } from 'expo-router';
import { Txt } from '@chrono/ui';
import { AuthForm } from '@/components/auth/AuthForm';
import { globalSupabaseClient } from '@/lib/supabase';
import { useT } from '@/lib/i18n';

function redirectTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth-callback`;
  }
  return 'chrono://auth-callback';
}

export default function ResetPassword() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  const requestReset = async (email: string) => {
    setBusy(true);
    setError(undefined);
    const { error: authError } = await globalSupabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo(),
    });
    setBusy(false);
    if (authError) setError(authError.message);
    else setSent(true);
  };

  return (
    <AuthForm
      title={t('auth.reset.title')}
      subtitle={sent ? t('auth.reset.sent') : t('auth.reset.subtitle')}
      submitLabel={t('auth.reset.submit')}
      onSubmit={(email) => requestReset(email)}
      withPassword={false}
      busy={busy}
      error={error}
      footer={
        <Link href="/(landing)/login">
          <Txt variant="caption" tone="accent">
            {t('auth.reset.backToSignIn')}
          </Txt>
        </Link>
      }
    />
  );
}
