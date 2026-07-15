import { describe, expect, it } from 'vitest';
import { capacityDaysInRange, utilization, utilizationStatus } from './capacity.lib';

describe('capacityDaysInRange', () => {
  it('prorates a 7-day range at the weekly capacity', () => {
    expect(capacityDaysInRange(5, { from: '2026-07-06', to: '2026-07-12' })).toBe(5);
  });

  it('prorates a partial week', () => {
    // 4 days (Mon-Thu) / 7 * 5 = 2.857...
    expect(capacityDaysInRange(5, { from: '2026-07-06', to: '2026-07-09' })).toBeCloseTo((4 / 7) * 5, 5);
  });

  it('is 0 for an open-ended range', () => {
    expect(capacityDaysInRange(5, {})).toBe(0);
    expect(capacityDaysInRange(5, { from: '2026-07-06' })).toBe(0);
  });
});

describe('utilization', () => {
  it('is worked / capacity as a percentage', () => {
    expect(utilization(4, 5)).toBe(80);
    expect(utilization(6, 5)).toBe(120);
  });

  it('is 0 when capacity is 0', () => {
    expect(utilization(4, 0)).toBe(0);
  });
});

describe('utilizationStatus', () => {
  it('flags over, under and ok', () => {
    expect(utilizationStatus(120)).toBe('over');
    expect(utilizationStatus(50)).toBe('under');
    expect(utilizationStatus(85)).toBe('ok');
  });

  it('accepts a custom under-threshold', () => {
    expect(utilizationStatus(60, 50)).toBe('ok');
  });
});
