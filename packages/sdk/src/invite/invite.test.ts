import { describe, expect, it } from 'vitest';
import {
  classifyInviteError,
  inviteState,
  isInviteRedeemable,
  sortCompanyInvites,
  tokenFromInput,
} from './invite.lib';

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

describe('sortCompanyInvites', () => {
  it('orders pending → accepted → expired → revoked', () => {
    const sorted = sortCompanyInvites(
      [
        { id: 'r', accepted_at: null, revoked_at: NOW, expires_at: '2999-01-01', created_at: '2026-01-01' },
        { id: 'a', accepted_at: NOW, revoked_at: null, expires_at: '2999-01-01', created_at: '2026-01-02' },
        { id: 'e', accepted_at: null, revoked_at: null, expires_at: '2000-01-01', created_at: '2026-01-03' },
        { id: 'p', accepted_at: null, revoked_at: null, expires_at: '2999-01-01', created_at: '2026-01-04' },
      ],
      NOW,
    );
    expect(sorted.map((i) => i.id)).toEqual(['p', 'a', 'e', 'r']);
  });

  it('sorts newest created_at first within the same state', () => {
    const sorted = sortCompanyInvites(
      [
        { id: 'old', accepted_at: null, revoked_at: null, expires_at: '2999-01-01', created_at: '2026-01-01' },
        { id: 'new', accepted_at: null, revoked_at: null, expires_at: '2999-01-01', created_at: '2026-06-01' },
      ],
      NOW,
    );
    expect(sorted.map((i) => i.id)).toEqual(['new', 'old']);
  });

  it('handles empty and single-item lists', () => {
    expect(sortCompanyInvites([], NOW)).toEqual([]);
    const one = [
      { id: 'only', accepted_at: null, revoked_at: null, expires_at: '2999-01-01', created_at: '2026-01-01' },
    ];
    expect(sortCompanyInvites(one, NOW)).toEqual(one);
  });

  it('keeps a mixed bag of all four states ordered', () => {
    const sorted = sortCompanyInvites(
      [
        { id: 'r1', accepted_at: null, revoked_at: NOW, expires_at: '2999', created_at: '2026-02-01' },
        { id: 'p1', accepted_at: null, revoked_at: null, expires_at: '2999', created_at: '2026-01-01' },
        { id: 'a1', accepted_at: NOW, revoked_at: null, expires_at: '2999', created_at: '2026-03-01' },
        { id: 'e1', accepted_at: null, revoked_at: null, expires_at: '2000', created_at: '2026-04-01' },
        { id: 'p2', accepted_at: null, revoked_at: null, expires_at: '2999', created_at: '2026-05-01' },
      ],
      NOW,
    );
    expect(sorted.map((i) => i.id)).toEqual(['p2', 'p1', 'a1', 'e1', 'r1']);
  });
});

describe('classifyInviteError', () => {
  it('maps the slugs raised by accept_company_invite', () => {
    expect(classifyInviteError('invite-not-found')).toBe('not_found');
    expect(classifyInviteError('invite-revoked')).toBe('revoked');
    expect(classifyInviteError('invite-used')).toBe('used');
    expect(classifyInviteError('invite-expired')).toBe('expired');
    expect(classifyInviteError('invite-unsigned')).toBe('unsigned');
    expect(classifyInviteError(new Error('invite-used'))).toBe('used');
  });

  it('maps the guards the join path trips', () => {
    expect(classifyInviteError('seat-limit-reached:3')).toBe('seat_limit');
    expect(classifyInviteError('role-admin-grant-forbidden')).toBe('admin_role');
    expect(classifyInviteError('invite-role-forbidden')).toBe('admin_role');
    expect(classifyInviteError('role-change-forbidden')).toBe('permission');
  });

  it('still maps prose messages from functions not yet on slugs', () => {
    expect(classifyInviteError('Invite not found')).toBe('not_found');
    expect(classifyInviteError('This invite has been revoked')).toBe('revoked');
    expect(classifyInviteError('This invite has already been used')).toBe('used');
    expect(classifyInviteError('This invite has expired')).toBe('expired');
    expect(classifyInviteError('Must be signed in to accept an invite')).toBe('unsigned');
    expect(classifyInviteError('Company has reached its seat limit (2) for the current plan')).toBe(
      'seat_limit',
    );
  });

  it('maps admin-role failures to admin_role, never as expired', () => {
    expect(classifyInviteError('Only an admin can grant or change the admin role')).toBe('admin_role');
    expect(classifyInviteError(new Error('Only an admin can grant or change the admin role'))).not.toBe(
      'expired',
    );
  });

  it('maps permission-style failures', () => {
    expect(classifyInviteError('Only an admin can change your role')).toBe('permission');
    expect(classifyInviteError('permission denied for table')).toBe('permission');
  });

  it('returns null for unrecognized errors', () => {
    expect(classifyInviteError('something else')).toBeNull();
    expect(classifyInviteError(null)).toBeNull();
  });
});

describe('tokenFromInput', () => {
  it('returns a raw token trimmed', () => {
    expect(tokenFromInput('  abcd1234  ')).toBe('abcd1234');
  });

  it('extracts token from query strings', () => {
    expect(tokenFromInput('https://app.example/join?token=abc123')).toBe('abc123');
    expect(tokenFromInput('https://app.example/join?foo=1&token=xyz&bar=2')).toBe('xyz');
    expect(tokenFromInput('chrono://join?token=hex')).toBe('hex');
  });
});
