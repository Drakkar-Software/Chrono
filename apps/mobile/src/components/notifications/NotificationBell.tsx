import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Txt, radii, spacing, useTheme } from '@chrono/ui';

/** Header bell that opens the notifications feed, with an unread-count badge. */
export function NotificationBell({ unread }: { unread: number }) {
  const router = useRouter();
  const { colors } = useTheme();
  const showBadge = unread > 0;

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={showBadge ? `Notifications, ${unread} unread` : 'Notifications'}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? colors.pressed : 'transparent' },
      ]}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.text} />
      {showBadge ? (
        <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.surface }]}>
          <Txt variant="micro" color={colors.onOverlay} numberOfLines={1}>
            {unread > 9 ? '9+' : String(unread)}
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
