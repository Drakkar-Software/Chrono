import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { IconButton, Txt, borders, radii, spacing, useTheme } from '@chrono/ui';

import { useT } from '@/lib/i18n';

/** Header bell that opens the notifications feed, with an unread-count badge. */
export function NotificationBell({ unread }: { unread: number }) {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const showBadge = unread > 0;

  return (
    <View style={styles.wrap}>
      <IconButton
        name="notifications-outline"
        onPress={() => router.push('/notifications')}
        accessibilityLabel={showBadge ? t('compb.notif.bellUnread', { n: unread }) : t('compb.notif.bell')}
      />
      {showBadge ? (
        <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.surface }]}>
          <Txt variant="micro" color={colors.onOverlay} numberOfLines={1}>
            {unread > 9 ? '9+' : String(unread)}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: radii.pill,
    borderWidth: borders.thin,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
