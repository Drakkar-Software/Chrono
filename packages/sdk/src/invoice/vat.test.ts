import { describe, expect, it } from 'vitest';
import { hasVat, vatBreakdown } from './invoice.lib';

describe('vatBreakdown', () => {
  it('applies a positive rate (rounded to the cent)', () => {
    expect(vatBreakdown(60000, 20)).toEqual({
      rate: 20,
      netCents: 60000,
      taxCents: 12000,
      grossCents: 72000,
    });
    // 33333 * 10% = 3333.3 -> 3333 cents
    expect(vatBreakdown(33333, 10)).toEqual({
      rate: 10,
      netCents: 33333,
      taxCents: 3333,
      grossCents: 36666,
    });
  });

  it('treats null / zero / negative rate as no VAT (gross = net)', () => {
    for (const rate of [null, undefined, 0, -5]) {
      expect(vatBreakdown(50000, rate)).toEqual({
        rate: 0,
        netCents: 50000,
        taxCents: 0,
        grossCents: 50000,
      });
    }
  });
});

describe('hasVat', () => {
  it('is true only for a positive rate', () => {
    expect(hasVat({ vat_rate: 20 })).toBe(true);
    expect(hasVat({ vat_rate: 0 })).toBe(false);
    expect(hasVat({ vat_rate: null })).toBe(false);
  });
});
