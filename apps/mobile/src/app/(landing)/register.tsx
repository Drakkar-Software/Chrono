import { useState } from 'react';
import { Link } from 'expo-router';
import { Txt } from '@chrono/ui';
import { AuthForm } from '@/components/auth/AuthForm';
import { globalSupabaseClient } from '@/lib/supabase';
import { useT } from '@/lib/i18n';

export default function Register() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  const signUp = async (email: string, password: string) => {
    setBusy(true);
    setError(undefined);
    const { error: authError } = await globalSupabaseClient.auth.signUp({ email, password });
    setBusy(false);
    if (authError) setError(authError.message);
    else setDone(true);
  };

  return (
    <AuthForm
      title={t('auth.createAccount')}
      subtitle={done ? t('auth.register.checkInbox') : t('auth.register.subtitle')}
      submitLabel={t('auth.signUp')}
      onSubmit={signUp}
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
