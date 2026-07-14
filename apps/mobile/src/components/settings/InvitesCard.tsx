import { useMemo, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { Badge, Button, Picker, TextField, Txt, spacing, useResponsive } from '@chrono/ui';
import { inviteState } from '@chrono/sdk';
import type { AppRole, CompanyInvite } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useCompanyInvites, useInviteMutations } from '@/lib/hooks/use-invites';
import { InlineError } from '@/components/common/ErrorState';

/**
 * Build a shareable invite link. Prefer an https universal link — it works for a
 * recipient who doesn't have the app yet (opens the web app / store), unlike the
 * `chrono://` scheme. Uses the current web origin on web, else EXPO_PUBLIC_APP_URL,
 * falling back to the scheme only when no web URL is configured.
 */
function inviteLink(token: string): string {
  const webOrigin =
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;
  const configuredBase = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/$/, '');
  const base = webOrigin ?? configuredBase ?? 'chrono:/';
  return `${base}/join?token=${token}`;
}

function statusTone(state: ReturnType<typeof inviteState>) {
  switch (state) {
    case 'accepted':
      return 'success' as const;
    case 'pending':
      return 'info' as const;
    default:
      return 'neutral' as const;
  }
}

export interface InvitesCardProps {
  companyId: string;
  invitedBy: string;
  /** Admins may invite at manager/admin roles; managers may only invite freelancers. */
  canGrantElevated: boolean;
}

/** Manager tool: invite teammates by email, and manage pending invites. */
export function InvitesCard({ companyId, invitedBy, canGrantElevated }: InvitesCardProps) {
  const t = useT();
  const { isWide } = useResponsive();
  const { data: invites } = useCompanyInvites(companyId);
  const { create, revoke, isPending, error } = useInviteMutations();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('freelancer');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const now = useMemo(() => new Date().toISOString(), []);
  const roleOptions = canGrantElevated
    ? [
        { label: t('role.freelancer'), value: 'freelancer' },
        { label: t('role.manager'), value: 'manager' },
        { label: t('role.admin'), value: 'admin' },
      ]
    : [{ label: t('role.freelancer'), value: 'freelancer' }];

  const send = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    await create({ companyId, email: trimmed, role, invitedBy });
    setEmail('');
    setRole('freelancer');
  };

  const shareLink = async (invite: CompanyInvite) => {
    const link = inviteLink(invite.token);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(link);
      setCopiedId(invite.id);
      return;
    }
    await Share.share({ message: t('compb.invites.shareMessage', { link }) });
  };

  const list = invites ?? [];

  return (
    <View style={styles.wrap}>
      <View style={[styles.form, isWide && styles.formWide]}>
        <View style={styles.emailField}>
          <TextField
            label={t('compb.invites.emailLabel')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('compb.invites.emailPlaceholder')}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        {canGrantElevated ? (
          <View style={styles.roleField}>
            <Picker label={t('compb.invites.roleLabel')} value={role} onValueChange={(v) => setRole(v as AppRole)} options={roleOptions} />
          </View>
        ) : null}
        <Button title={t('compb.invites.send')} onPress={send} loading={isPending} disabled={!email.trim()} fullWidth={!isWide} />
      </View>
      {error ? <InlineError error={error} describe={{ fallback: t('compb.invites.createFail') }} /> : null}

      {list.length === 0 ? (
        <Txt variant="caption" tone="textMuted">
          {t('compb.invites.empty')}
        </Txt>
      ) : (
        list.map((invite) => {
          const state = inviteState(invite, now);
          const redeemable = state === 'pending';
          return (
            <View key={invite.id} style={[styles.invite, isWide && styles.inviteWide]}>
              <View style={styles.inviteInfo}>
                <Txt variant="bodyMedium" numberOfLines={1}>
                  {invite.email}
                </Txt>
                <View style={styles.inviteMeta}>
                  <Txt variant="caption" tone="textMuted">
                    {t('role.' + invite.role)}
                  </Txt>
                  <Badge label={t('compb.invites.state.' + state)} status={statusTone(state)} />
                </View>
              </View>
              <View style={styles.inviteActions}>
                {redeemable ? (
                  <Button
                    title={
                      Platform.OS === 'web'
                        ? copiedId === invite.id
                          ? t('compb.invites.copied')
                          : t('compb.invites.copyLink')
                        : t('compb.invites.shareLink')
                    }
                    size="sm"
                    variant="secondary"
                    onPress={() => void shareLink(invite)}
                  />
                ) : null}
                {redeemable ? (
                  <Button title={t('compb.invites.revoke')} size="sm" variant="ghost" onPress={() => void revoke(invite.id)} />
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  form: { gap: spacing.md },
  formWide: { flexDirection: 'row', alignItems: 'flex-end' },
  emailField: { flex: 1 },
  roleField: { minWidth: 140 },
  invite: { gap: spacing.sm, paddingTop: spacing.sm },
  inviteWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inviteInfo: { gap: spacing.xs, flex: 1 },
  inviteMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inviteActions: { flexDirection: 'row', gap: spacing.sm },
});
