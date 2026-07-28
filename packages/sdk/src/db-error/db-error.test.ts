import { describe, expect, it } from 'vitest';
import { parseDbError } from './db-error.lib';

describe('parseDbError', () => {
  it('parses a bare slug', () => {
    expect(parseDbError('rem-month-locked')).toEqual({ slug: 'rem-month-locked', params: [] });
    expect(parseDbError(new Error('invite-used'))).toEqual({ slug: 'invite-used', params: [] });
    expect(parseDbError({ message: 'project-not-found' })).toEqual({
      slug: 'project-not-found',
      params: [],
    });
  });

  it('parses appended params in order', () => {
    expect(parseDbError('capacity-exceeded:7')).toEqual({
      slug: 'capacity-exceeded',
      params: ['7'],
    });
    expect(parseDbError('time-net-negative-correction:-120:45')).toEqual({
      slug: 'time-net-negative-correction',
      params: ['-120', '45'],
    });
  });

  it('returns null for prose, so callers keep their generic handling', () => {
    expect(parseDbError('Only a manager can settle a project month')).toBeNull();
    expect(parseDbError('permission denied for table time_entries')).toBeNull();
    expect(parseDbError('new row violates row-level security policy')).toBeNull();
    expect(parseDbError('')).toBeNull();
    expect(parseDbError(null)).toBeNull();
  });

  it('rejects single words and uppercase, which prose could produce', () => {
    expect(parseDbError('locked')).toBeNull();
    expect(parseDbError('Rem-Month-Locked')).toBeNull();
  });
});
