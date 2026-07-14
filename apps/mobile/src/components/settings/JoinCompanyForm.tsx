import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, TextField, Txt, spacing, useResponsive } from '@chrono/ui';

import { useJoinCompany } from '@/lib/hooks/use-company-members';
import { describeError } from '@/components/common/ErrorState';

export interface JoinCompanyFormProps {
  userId: string | undefined;
  /** Called with the joined company id after a successful join. */
  onJoined: (companyId: string) => void | Promise<void>;
}

/** Join another company by its id ("join code"), then switch to it. */
export function JoinCompanyForm({ userId, onJoined }: JoinCompanyFormProps) {
  const { isWide } = useResponsive();
  const { mutateAsync, isPending } = useJoinCompany();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const join = async () => {
    const companyId = code.trim();
    if (!userId || !companyId) return;
    setMessage(null);
    try {
      await mutateAsync({ companyId, userId });
      setCode('');
      await onJoined(companyId);
    } catch (e) {
      setMessage(
        describeError(e, {
          duplicateMessage: "You're already a member of that company.",
          fallback: 'Couldn’t join — check the code and try again.',
        }),
      );
    }
  };

  return (
    <View style={styles.wrap}>
      <TextField
        label="Company code"
        value={code}
        onChangeText={setCode}
        placeholder="Paste a company code"
        autoCapitalize="none"
      />
      {message ? (
        <Txt variant="caption" tone="danger">
          {message}
        </Txt>
      ) : null}
      <Button
        title="Join"
        onPress={join}
        loading={isPending}
        disabled={!code.trim()}
        fullWidth={!isWide}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
});
