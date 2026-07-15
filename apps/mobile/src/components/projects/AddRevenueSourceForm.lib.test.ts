import { describe, expect, it } from 'vitest';
import { resolveDayRateCents, toCents, toNumber } from './AddRevenueSourceForm.lib';

describe('toCents', () => {
  it('parses a plain number to integer cents', () => {
    expect(toCents('500')).toBe(50000);
  });

  it('accepts a comma decimal separator', () => {
    expect(toCents('12,5')).toBe(1250);
  });

  it('returns 0 for blank or unparseable input', () => {
    expect(toCents('')).toBe(0);
    expect(toCents('abc')).toBe(0);
  });
});

describe('toNumber', () => {
  it('parses a plain or comma-decimal number', () => {
    expect(toNumber('10')).toBe(10);
    expect(toNumber('2,5')).toBe(2.5);
  });

  it('returns undefined for blank or unparseable input', () => {
    expect(toNumber('')).toBeUndefined();
    expect(toNumber('abc')).toBeUndefined();
  });
});

describe('resolveDayRateCents', () => {
  it('uses the entered amount when present', () => {
    expect(resolveDayRateCents('600', 50000)).toBe(60000);
  });

  it('falls back to the project default TJM when the field is left blank', () => {
    expect(resolveDayRateCents('', 50000)).toBe(50000);
  });

  it('falls back to the project default TJM when the field is unparseable', () => {
    expect(resolveDayRateCents('abc', 50000)).toBe(50000);
  });

  it('falls back to 0 when neither an entered amount nor a project default exist', () => {
    expect(resolveDayRateCents('', undefined)).toBe(0);
    expect(resolveDayRateCents('', null)).toBe(0);
  });

  it('treats an entered 0 as blank and still falls back to the default', () => {
    expect(resolveDayRateCents('0', 50000)).toBe(50000);
  });
});
