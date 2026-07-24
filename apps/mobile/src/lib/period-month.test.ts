import { describe, expect, it } from 'vitest';
import {
  longMonthLabel,
  matchesPeriodMonth,
  selectableMonths,
  stampMonthLabel,
} from './period-month';

describe('period-month', () => {
  it('lists newest months first ending at today', () => {
    const months = selectableMonths(3, '2026-07-24');
    expect(months).toEqual(['2026-07', '2026-06', '2026-05']);
  });

  it('matches period month prefixes', () => {
    expect(matchesPeriodMonth('2026-07-01', '2026-07')).toBe(true);
    expect(matchesPeriodMonth('2026-06-01', '2026-07')).toBe(false);
  });

  it('formats stamp and long labels', () => {
    expect(stampMonthLabel('2026-07', 'en')).toMatch(/JUL/);
    expect(longMonthLabel('2026-07', 'en')).toMatch(/2026/);
  });
});
