import { useState, type ReactNode } from 'react';
import { Button, TextField, Txt } from '@chrono/ui';
import { useT } from '@/lib/i18n';
import { AuthCard } from '@/components/common/AuthCard';

export interface AuthFormProps {
  title: string;
  subtitle?: string;
  submitLabel: string;
  onSubmit: (email: string, password: string) => Promise<void> | void;
  /** Render a password field. Default true. */
  withPassword?: boolean;
  /** Render a confirm-password field and require a match (register). Default false. */
  withConfirm?: boolean;
  busy?: boolean;
  error?: string;
  footer?: ReactNode;
}

/** Email/password auth scaffold shared by login, register and reset screens. */
export function AuthForm({
  title,
  subtitle,
  submitLabel,
  onSubmit,
  withPassword = true,
  withConfirm = false,
  busy = false,
  error,
  footer,
}: AuthFormProps) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const mismatch = withConfirm && confirm.length > 0 && password !== confirm;
  const canSubmit = email.trim().length > 0 && (!withPassword || password.length > 0) && !mismatch;

  return (
    <AuthCard title={title} subtitle={subtitle} footer={footer}>
      <TextField
        label={t('compb.auth.email')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('compb.auth.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {withPassword ? (
        <TextField
          label={t('compb.auth.password')}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
        />
      ) : null}
      {withConfirm ? (
        <TextField
          label={t('auth.confirmPassword')}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          error={mismatch ? t('auth.errors.passwordMismatch') : undefined}
        />
      ) : null}
      {error ? (
        <Txt variant="caption" tone="danger" center>
          {error}
        </Txt>
      ) : null}
      <Button
        title={submitLabel}
        onPress={() => onSubmit(email.trim(), password)}
        loading={busy}
        disabled={!canSubmit}
        fullWidth
      />
    </AuthCard>
  );
}
