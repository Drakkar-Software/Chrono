import { describe, expect, it } from 'vitest';
import { dayCapExceeded, formatMinutesAsHoursInput, parseHoursToMinutes } from './time-entry-form.lib';

describe('parseHoursToMinutes', () => {
  it('parses a plain number of hours to minutes', () => {
    expect(parseHoursToMinutes('2')).toBe(120);
  });

  it('accepts a comma decimal separator', () => {
    expect(parseHoursToMinutes('1,5')).toBe(90);
  });

  it('accepts a dot decimal separator', () => {
    expect(parseHoursToMinutes('0.25')).toBe(15);
  });

  it('parses negative corrections', () => {
    expect(parseHoursToMinutes('-2')).toBe(-120);
    expect(parseHoursToMinutes('−1,5')).toBe(-90);
  });

  it('returns 0 for blank or unparseable input', () => {
    expect(parseHoursToMinutes('')).toBe(0);
    expect(parseHoursToMinutes('abc')).toBe(0);
  });
});

describe('isValidDurationMinutes', () => {
  it('rejects zero and accepts signed non-zero', async () => {
    const { isValidDurationMinutes } = await import('./time-entry-form.lib');
    expect(isValidDurationMinutes(0)).toBe(false);
    expect(isValidDurationMinutes(60)).toBe(true);
    expect(isValidDurationMinutes(-30)).toBe(true);
  });
});

describe('formatMinutesAsHoursInput', () => {
  it('formats whole hours without a decimal', () => {
    expect(formatMinutesAsHoursInput(120)).toBe('2');
  });

  it('formats fractional hours', () => {
    expect(formatMinutesAsHoursInput(90)).toBe('1.5');
  });

  it('round-trips through parseHoursToMinutes', () => {
    expect(parseHoursToMinutes(formatMinutesAsHoursInput(450))).toBe(450);
  });
});

describe('dayCapExceeded', () => {
  it('is false when the candidate entry stays under the cap', () => {
    // 420 minutes at 7h/day = 1 day; 10 + 1 = 11, under a 23-day cap.
    expect(dayCapExceeded(420, 7, 10, 23)).toBe(false);
  });

  it('is false when landing exactly on the cap', () => {
    expect(dayCapExceeded(420, 7, 22, 23)).toBe(false);
  });

  it('is true when the candidate entry pushes past the cap', () => {
    expect(dayCapExceeded(420, 7, 23, 23)).toBe(true);
  });

  it('respects a different hours-per-day for the candidate project', () => {
    // 480 minutes at 8h/day = 1 day.
    expect(dayCapExceeded(480, 8, 22, 23)).toBe(false);
    expect(dayCapExceeded(480, 8, 23, 23)).toBe(true);
  });

  it('is false with a zero-minute candidate regardless of prior logged days', () => {
    expect(dayCapExceeded(0, 7, 23, 23)).toBe(false);
  });

  it('is false for negative corrections even when already at the cap', () => {
    expect(dayCapExceeded(-420, 7, 23, 23)).toBe(false);
  });
});
