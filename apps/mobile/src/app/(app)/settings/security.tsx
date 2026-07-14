import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, StackScreen, TextField, Txt, spacing } from '@chrono/ui';

import { globalSupabaseClient } from '@/lib/supabase';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Set a new account password. Reached after a password-recovery link (see
 * `auth-callback` recovery route) or from settings to change the password.
 */
export default function SecurityScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setError(undefined);
    setBusy(true);
    const { error: authError } = await globalSupabaseClient.auth.updateUser({ password });
    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setPassword('');
    setConfirm('');
    setDone(true);
  };

  return (
    <StackScreen title="Security">
      <View style={styles.wrap}>
        <Card padding="lg" style={styles.card}>
          <Txt variant="heading">Set a new password</Txt>
          <Txt variant="caption" tone="textMuted">
            Choose a new password for your account.
          </Txt>
          <TextField
            label="New password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
          />
          <TextField
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
          />
          {error ? (
            <Txt variant="caption" tone="danger">
              {error}
            </Txt>
          ) : null}
          {done ? (
            <Txt variant="caption" tone="success">
              Password updated.
            </Txt>
          ) : null}
          <Button title="Update password" onPress={submit} loading={busy} fullWidth />
          {done ? (
            <Button title="Back to settings" variant="ghost" onPress={() => router.replace('/settings')} />
          ) : null}
        </Card>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  card: { gap: spacing.md },
});
