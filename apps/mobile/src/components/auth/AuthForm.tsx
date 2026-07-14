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
  busy = false,
  error,
  footer,
}: AuthFormProps) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
      {error ? (
        <Txt variant="caption" tone="danger" center>
          {error}
        </Txt>
      ) : null}
      <Button
        title={submitLabel}
        onPress={() => onSubmit(email.trim(), password)}
        loading={busy}
        fullWidth
      />
    </AuthCard>
  );
}
