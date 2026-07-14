import type { Tables, TablesInsert, TablesUpdate } from '../schema';

export type Notification = Tables<'notifications'>;
export type NotificationInsert = TablesInsert<'notifications'>;
export type NotificationUpdate = TablesUpdate<'notifications'>;
