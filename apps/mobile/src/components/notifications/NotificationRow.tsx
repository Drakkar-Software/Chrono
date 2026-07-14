import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Txt, borders, opacity, radii, spacing, useTheme } from '@chrono/ui';
import { notificationIcon, notificationTone } from '@chrono/sdk';
import type { Notification } from '@chrono/sdk';

import { relativeTime } from '@/lib/date';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export function NotificationRow({
  notification,
  onPress,
  onDismiss,
}: {
  notification: Notification;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const unread = notification.read_at == null;
  const tone = notificationTone(notification.type);
  const toneColor = colors[tone];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.pressed : unread ? colors.accentBg : 'transparent',
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.fill }]}>
        <Ionicons name={notificationIcon(notification.type) as IoniconName} size={18} color={toneColor} />
      </View>
      <View style={styles.body}>
        <Txt variant="bodyMedium" numberOfLines={1}>
          {notification.title}
        </Txt>
        {notification.body ? (
          <Txt variant="caption" tone="textMuted" numberOfLines={2}>
            {notification.body}
          </Txt>
        ) : null}
        <Txt variant="micro" tone="textFaint">
          {relativeTime(notification.created_at)}
        </Txt>
      </View>
      {unread ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        hitSlop={8}
        style={({ pressed }) => [styles.dismiss, { opacity: pressed ? opacity.muted : 1 }]}
      >
        <Ionicons name="close" size={16} color={colors.textFaint} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: borders.thin,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  dot: { width: 8, height: 8, borderRadius: radii.pill },
  dismiss: { padding: spacing.xs },
});
