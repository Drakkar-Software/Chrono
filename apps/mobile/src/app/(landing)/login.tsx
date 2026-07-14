import { useState } from 'react';
import { Link } from 'expo-router';
import { Txt } from '@chrono/ui';
import { AuthForm } from '@/components/auth/AuthForm';
import { globalSupabaseClient } from '@/lib/supabase';

export default function Login() {
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
    if (authError) setError(authError.message);
  };

  return (
    <AuthForm
      title="Welcome back"
      subtitle="Sign in to your Chrono account"
      submitLabel="Sign in"
      onSubmit={signIn}
      busy={busy}
      error={error}
      footer={
        <>
          <Link href="/(landing)/register">
            <Txt variant="caption" tone="accent">
              Create an account
            </Txt>
          </Link>
          <Link href="/(landing)/reset-password">
            <Txt variant="caption" tone="textMuted">
              Forgot your password?
            </Txt>
          </Link>
        </>
      }
    />
  );
}
