import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, TextField, Txt, spacing, useResponsive } from '@chrono/ui';
import { classifyInviteError, tokenFromInput } from '@chrono/sdk';
import type { InviteErrorKind } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useInviteMutations } from '@/lib/hooks/use-invites';

export interface JoinCompanyFormProps {
  userId: string | undefined;
  /** Called with the joined company id after a successful redemption. */
  onJoined: (companyId: string) => void | Promise<void>;
}

export { tokenFromInput };

function inviteErrorMessage(kind: InviteErrorKind, t: ReturnType<typeof useT>): string {
  switch (kind) {
    case 'not_found':
      return t('compb.join.errNotFound');
    case 'revoked':
      return t('compb.join.errRevoked');
    case 'used':
      return t('compb.join.errUsed');
    case 'expired':
      return t('compb.join.errExpired');
    case 'unsigned':
      return t('compb.join.errUnsigned');
    case 'seat_limit':
      return t('compb.join.errSeatLimit');
    case 'admin_role':
    case 'permission':
      return t('compb.join.errPermission');
    default:
      return t('compb.join.fallback');
  }
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
      const kind = classifyInviteError(e);
      setMessage(kind ? inviteErrorMessage(kind, t) : t('compb.join.fallback'));
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
