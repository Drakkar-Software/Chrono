import type { NotificationType } from '../schema';
import type { Notification } from './notification.entity';

/** Count of unread, non-dismissed notifications. */
export function unreadCount(
  notifications: Pick<Notification, 'read_at' | 'deleted'>[],
): number {
  return notifications.filter((n) => n.read_at == null && !n.deleted).length;
}

/**
 * Ionicons glyph name for a notification type. Kept in the SDK (a plain string)
 * so the icon stays consistent everywhere the feed is rendered.
 */
export function notificationIcon(type: NotificationType): string {
  switch (type) {
    case 'time_submitted':
      return 'time-outline';
    case 'time_approved':
      return 'checkmark-circle-outline';
    case 'time_rejected':
      return 'close-circle-outline';
    case 'invoice_paid':
      return 'cash-outline';
    case 'invoice_partially_paid':
      return 'wallet-outline';
    case 'referral_earned':
      return 'gift-outline';
    default:
      return 'notifications-outline';
  }
}

/** Semantic tone for a notification type (maps to theme tones in the UI). */
export function notificationTone(
  type: NotificationType,
): 'accent' | 'success' | 'danger' | 'text' {
  switch (type) {
    case 'time_approved':
    case 'invoice_paid':
    case 'referral_earned':
      return 'success';
    case 'time_rejected':
      return 'danger';
    case 'time_submitted':
    case 'invoice_partially_paid':
      return 'accent';
    default:
      return 'text';
  }
}
