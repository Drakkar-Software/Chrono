import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Button, TextField, Txt } from '@chrono/ui';
import { AuthCard } from '@/components/common/AuthCard';
import { authErrorKey, sendPasswordRecovery, verifyRecoveryOTP } from '@/lib/auth-utils';
import { useT } from '@/lib/i18n';

/**
 * Password recovery, matching Aesthemedstaff's two-step OTP flow: request a
 * recovery email (one-click link + 6-digit code), then type the code to verify
 * and land on the set-new-password screen. The typed-code path is robust on
 * native where email-link deep-linking is unreliable.
 */
export default function ResetPassword() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const requestCode = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(undefined);
    const { error: authError } = await sendPasswordRecovery(email.trim());
    setBusy(false);
    if (authError) setError(t(authErrorKey(authError)));
    else setRequested(true);
  };

  const verifyCode = async () => {
    if (!otp.trim()) return;
    setBusy(true);
    setError(undefined);
    const { error: authError } = await verifyRecoveryOTP(email.trim(), otp.trim());
    setBusy(false);
    if (authError) {
      setError(t(authErrorKey(authError)));
      return;
    }
    // Session established → set the new password.
    router.replace('/settings/security');
  };

  const backToSignIn = (
    <Link href="/(landing)/login">
      <Txt variant="caption" tone="accent">
        {t('auth.reset.backToSignIn')}
      </Txt>
    </Link>
  );

  if (requested) {
    return (
      <AuthCard title={t('auth.reset.enterCodeTitle')} subtitle={t('auth.reset.enterCodeSubtitle')} footer={backToSignIn}>
        <TextField
          label={t('auth.reset.codeLabel')}
          value={otp}
          onChangeText={setOtp}
          placeholder={t('auth.reset.codePlaceholder')}
          keyboardType="number-pad"
          autoCapitalize="none"
        />
        {error ? (
          <Txt variant="caption" tone="danger" center>
            {error}
          </Txt>
        ) : null}
        <Button title={t('auth.reset.verify')} onPress={verifyCode} loading={busy} disabled={!otp.trim()} fullWidth />
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')} footer={backToSignIn}>
      <TextField
        label={t('compb.auth.email')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('compb.auth.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {error ? (
        <Txt variant="caption" tone="danger" center>
          {error}
        </Txt>
      ) : null}
      <Button title={t('auth.reset.submit')} onPress={requestCode} loading={busy} disabled={!email.trim()} fullWidth />
    </AuthCard>
  );
}
