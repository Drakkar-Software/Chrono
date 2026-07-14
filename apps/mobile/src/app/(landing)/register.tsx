import { useState } from 'react';
import { Link } from 'expo-router';
import { Txt } from '@chrono/ui';
import { AuthForm } from '@/components/auth/AuthForm';
import { globalSupabaseClient } from '@/lib/supabase';

export default function Register() {
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
      title="Create your account"
      subtitle={done ? 'Check your inbox to confirm your email.' : 'Start tracking your time'}
      submitLabel="Sign up"
      onSubmit={signUp}
      busy={busy}
      error={error}
      footer={
        <Link href="/(landing)/login">
          <Txt variant="caption" tone="accent">
            Already have an account? Sign in
          </Txt>
        </Link>
      }
    />
  );
}
