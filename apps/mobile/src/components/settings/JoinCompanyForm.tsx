import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, TextField, Txt, spacing, useResponsive } from '@chrono/ui';

import { useT } from '@/lib/i18n';
import { useInviteMutations } from '@/lib/hooks/use-invites';
import { describeError } from '@/components/common/ErrorState';

export interface JoinCompanyFormProps {
  userId: string | undefined;
  /** Called with the joined company id after a successful redemption. */
  onJoined: (companyId: string) => void | Promise<void>;
}

/** Extract the token from a pasted invite link, or use the raw value as-is. */
export function tokenFromInput(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/[?&]token=([^&\s]+)/);
  return (match?.[1] ?? trimmed).trim();
}

/** Join a company by redeeming an invite token (or a pasted invite link). */
export function JoinCompanyForm({ userId, onJoined }: JoinCompanyFormProps) {
  const t = useT();
  const { isWide } = useResponsive();
  const { accept, isPending } = useInviteMutations();
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const join = async () => {
    const token = tokenFromInput(value);
    if (!userId || !token) return;
    setMessage(null);
    try {
      const companyId = await accept(token);
      setValue('');
      await onJoined(companyId);
    } catch (e) {
      setMessage(
        describeError(e, {
          fallback: t('compb.join.fallback'),
        }),
      );
    }
  };

  return (
    <View style={styles.wrap}>
      <TextField
        label={t('compb.join.codeLabel')}
        value={value}
        onChangeText={setValue}
        placeholder={t('compb.join.codePlaceholder')}
        autoCapitalize="none"
      />
      {message ? (
        <Txt variant="caption" tone="danger">
          {message}
        </Txt>
      ) : null}
      <Button
        title={t('common.join')}
        onPress={join}
        loading={isPending}
        disabled={!tokenFromInput(value)}
        fullWidth={!isWide}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
});
