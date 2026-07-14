import { describe, expect, it } from 'vitest';
import { inviteState, isInviteRedeemable } from './invite.lib';

const NOW = '2026-07-14T00:00:00.000Z';

describe('inviteState', () => {
  it('prioritizes accepted over everything', () => {
    expect(
      inviteState({ accepted_at: NOW, revoked_at: NOW, expires_at: '2000-01-01' }, NOW),
    ).toBe('accepted');
  });

  it('reports revoked, then expired, then pending', () => {
    expect(inviteState({ accepted_at: null, revoked_at: NOW, expires_at: '2999-01-01' }, NOW)).toBe('revoked');
    expect(inviteState({ accepted_at: null, revoked_at: null, expires_at: '2000-01-01' }, NOW)).toBe('expired');
    expect(inviteState({ accepted_at: null, revoked_at: null, expires_at: '2999-01-01' }, NOW)).toBe('pending');
  });
});

describe('isInviteRedeemable', () => {
  it('is true only when pending', () => {
    expect(isInviteRedeemable({ accepted_at: null, revoked_at: null, expires_at: '2999-01-01' }, NOW)).toBe(true);
    expect(isInviteRedeemable({ accepted_at: NOW, revoked_at: null, expires_at: '2999-01-01' }, NOW)).toBe(false);
  });
});
