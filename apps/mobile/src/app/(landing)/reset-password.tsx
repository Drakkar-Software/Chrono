import { useState } from 'react';
import { Platform } from 'react-native';
import { Link } from 'expo-router';
import { Txt } from '@chrono/ui';
import { AuthForm } from '@/components/auth/AuthForm';
import { globalSupabaseClient } from '@/lib/supabase';

function redirectTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth-callback`;
  }
  return 'chrono://auth-callback';
}

export default function ResetPassword() {
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
      title="Reset your password"
      subtitle={sent ? 'If that email exists, a reset link is on its way.' : 'Enter your email to get a reset link'}
      submitLabel="Send reset link"
      onSubmit={(email) => requestReset(email)}
      withPassword={false}
      busy={busy}
      error={error}
      footer={
        <Link href="/(landing)/login">
          <Txt variant="caption" tone="accent">
            Back to sign in
          </Txt>
        </Link>
      }
    />
  );
}
