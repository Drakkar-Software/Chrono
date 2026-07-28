import { describe, expect, it } from 'vitest';
import {
  parseRemKind,
  parseRemPolicy,
  parseRemSettings,
  validateProjectRemFields,
} from './rem-form.lib';

describe('parseRemSettings', () => {
  it('accepts valid percents and hours', () => {
    const r = parseRemSettings({
      companyFeePct: '5',
      remMaxPercent: '75',
      defaultLicensePct: '30',
      defaultHoursPerDay: '8',
    });
    expect(r.company_fee_pct).toBe(5);
    expect(r.rem_max_percent).toBe(75);
    expect(r.default_license_pct).toBe(30);
    expect(r.default_hours_per_day).toBe(8);
    expect(r.error).toBeUndefined();
  });

  it('uses canonical defaults for empty fields', () => {
    const r = parseRemSettings({
      companyFeePct: '',
      remMaxPercent: '',
      defaultLicensePct: '',
      defaultHoursPerDay: '',
    });
    expect(r).toEqual({
      company_fee_pct: 5,
      rem_max_percent: 75,
      default_license_pct: 30,
      default_hours_per_day: 8,
    });
  });

  it.each([
    ['companyFeePct', '-1', 'company_fee_pct'],
    ['companyFeePct', '101', 'company_fee_pct'],
    ['remMaxPercent', 'nope', 'rem_max_percent'],
    ['defaultLicensePct', '100.1', 'default_license_pct'],
  ] as const)('rejects invalid %s instead of clamping', (field, value, error) => {
    const input = {
      companyFeePct: '5',
      remMaxPercent: '75',
      defaultLicensePct: '30',
      defaultHoursPerDay: '8',
      [field]: value,
    };
    expect(parseRemSettings(input).error).toBe(error);
  });

  it('rejects non-positive hours', () => {
    const r = parseRemSettings({
      companyFeePct: '0',
      remMaxPercent: '100',
      defaultLicensePct: '0',
      defaultHoursPerDay: '0',
    });
    expect(r.error).toBe('hours');
  });
});

describe('parseRemPolicy / kind', () => {
  it('defaults to staffing', () => {
    expect(parseRemPolicy(null)).toBe('staffing');
    expect(parseRemPolicy('nope')).toBe('staffing');
    expect(parseRemPolicy('product_pool')).toBe('product_pool');
  });

  it('maps deprecated external_tjm to staffing', () => {
    expect(parseRemPolicy('external_tjm')).toBe('staffing');
  });

  it('parses rem kind', () => {
    expect(parseRemKind(null)).toBeNull();
    expect(parseRemKind('maintenance')).toBe('maintenance');
  });
});

describe('validateProjectRemFields', () => {
  it('requires rem_kind for product policies', () => {
    expect(
      validateProjectRemFields({
        remPolicy: 'product_pool',
        remKind: null,
        jungleFictitiousTjmCents: null,
      }),
    ).toBe('rem_kind');
  });

  it('requires day-rate credit TJM', () => {
    expect(
      validateProjectRemFields({
        remPolicy: 'jungle',
        remKind: null,
        jungleFictitiousTjmCents: null,
      }),
    ).toBe('jungle_tjm');
  });

  it('staffing ok', () => {
    expect(
      validateProjectRemFields({
        remPolicy: 'staffing',
        remKind: null,
        jungleFictitiousTjmCents: null,
      }),
    ).toBeNull();
  });
});
