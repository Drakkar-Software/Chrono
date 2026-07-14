import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Screen, TextField, Txt, spacing } from '@chrono/ui';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Screen>
      <View style={styles.wrap}>
        <Card padding="xl" style={styles.card}>
          <Txt variant="title" center>
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="body" tone="textMuted" center>
              {subtitle}
            </Txt>
          ) : null}
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {withPassword ? (
            <TextField
              label="Password"
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
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  card: { gap: spacing.md, width: '100%', maxWidth: 400, alignSelf: 'center' },
  footer: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
});
