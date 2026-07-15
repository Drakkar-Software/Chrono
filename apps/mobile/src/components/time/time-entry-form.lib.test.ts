import { describe, expect, it } from 'vitest';
import { formatMinutesAsHoursInput, parseHoursToMinutes } from './time-entry-form.lib';

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

  it('returns 0 for blank or unparseable input', () => {
    expect(parseHoursToMinutes('')).toBe(0);
    expect(parseHoursToMinutes('abc')).toBe(0);
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
