import { describe, expect, it } from 'vitest';
import { notificationIcon, notificationTone, unreadCount } from './notification.lib';

describe('unreadCount', () => {
  it('counts only unread, non-dismissed', () => {
    expect(
      unreadCount([
        { read_at: null, deleted: false },
        { read_at: '2026-07-01', deleted: false },
        { read_at: null, deleted: true },
        { read_at: null, deleted: false },
      ]),
    ).toBe(2);
  });
});

describe('notificationTone', () => {
  it('maps positive/negative/neutral types', () => {
    expect(notificationTone('invoice_paid')).toBe('success');
    expect(notificationTone('time_rejected')).toBe('danger');
    expect(notificationTone('time_submitted')).toBe('accent');
  });
});

describe('notificationIcon', () => {
  it('returns a glyph for each known type', () => {
    expect(notificationIcon('referral_earned')).toBe('gift-outline');
    expect(notificationIcon('time_approved')).toBe('checkmark-circle-outline');
  });
});
