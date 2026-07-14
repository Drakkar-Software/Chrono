import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, StackScreen, TextField, TitledCard, Txt, spacing } from '@chrono/ui';

import { globalSupabaseClient } from '@/lib/supabase';
import { useT } from '@/lib/i18n';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Set a new account password. Reached after a password-recovery link (see
 * `auth-callback` recovery route) or from settings to change the password.
 */
export default function SecurityScreen() {
  const t = useT();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('tabs.security.tooShort', { n: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t('tabs.security.mismatch'));
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
    <StackScreen title={t('tabs.security.title')}>
      <View style={styles.wrap}>
        <TitledCard title={t('tabs.security.heading')}>
          <Txt variant="caption" tone="textMuted">
            {t('tabs.security.subtitle')}
          </Txt>
          <TextField
            label={t('tabs.security.newPassword')}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
          />
          <TextField
            label={t('tabs.security.confirmPassword')}
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
              {t('tabs.security.updated')}
            </Txt>
          ) : null}
          <Button title={t('tabs.security.updatePassword')} onPress={submit} loading={busy} fullWidth />
          {done ? (
            <Button title={t('tabs.security.backToSettings')} variant="ghost" onPress={() => router.replace('/settings')} />
          ) : null}
        </TitledCard>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
});
