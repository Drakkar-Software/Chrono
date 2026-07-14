import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../schema';
import type { Notification } from './notification.entity';

type Client = SupabaseClient<Database>;

export const NOTIFICATION_SELECT = '*' as const;

/** A user's notifications, newest first. Capped to a sane page. */
export async function fetchNotifications(
  client: Client,
  userId: string,
  limit = 100,
): Promise<Notification[]> {
  const { data, error } = await client
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('user_id', userId)
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

/** Mark a single notification read (idempotent). */
export async function markNotificationRead(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
  if (error) throw error;
}

/** Mark every unread notification for a user read. */
export async function markAllNotificationsRead(
  client: Client,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

/** Dismiss (soft-delete) a notification. */
export async function dismissNotification(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client
    .from('notifications')
    .update({ deleted: true })
    .eq('id', id);
  if (error) throw error;
}
