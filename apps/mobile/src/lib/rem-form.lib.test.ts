import { describe, expect, it } from 'vitest';
import {
  parseRemKind,
  parseRemPolicy,
  parseRemSettings,
  validateProjectRemFields,
} from './rem-form.lib';

describe('parseRemSettings', () => {
  it('clamps percents and accepts hours', () => {
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

  it('requires jungle TJM', () => {
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
