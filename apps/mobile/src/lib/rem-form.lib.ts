import {
  DEFAULT_COMPANY_FEE_PCT,
  DEFAULT_HOURS_PER_DAY,
  DEFAULT_LICENSE_PCT,
  DEFAULT_REM_MAX_PERCENT,
  defaultRemPolicy,
  isValidJungleTjm,
  remKindRequired,
  type RemKind,
  type RemPolicy,
  REM_KINDS,
  REM_POLICIES,
} from '@chrono/sdk';

export { remKindRequired };

export type RemSettingsInput = {
  companyFeePct: string;
  remMaxPercent: string;
  defaultLicensePct: string;
  defaultHoursPerDay: string;
};

export type RemSettingsParsed = {
  company_fee_pct: number;
  rem_max_percent: number;
  default_license_pct: number;
  default_hours_per_day: number;
  error?: 'company_fee_pct' | 'rem_max_percent' | 'default_license_pct' | 'hours';
};

function parsePercent(value: string, fallback: number): number | null {
  if (value.trim() === '') return fallback;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
}

/** Parse company rem settings fields with canonical defaults and strict validation. */
export function parseRemSettings(input: RemSettingsInput): RemSettingsParsed {
  const fee = parsePercent(input.companyFeePct, DEFAULT_COMPANY_FEE_PCT);
  const max = parsePercent(input.remMaxPercent, DEFAULT_REM_MAX_PERCENT);
  const lic = parsePercent(input.defaultLicensePct, DEFAULT_LICENSE_PCT);
  const rawHours = input.defaultHoursPerDay.trim();
  const hours =
    rawHours === '' ? DEFAULT_HOURS_PER_DAY : Number(input.defaultHoursPerDay.replace(',', '.'));

  const values = {
    company_fee_pct: fee ?? DEFAULT_COMPANY_FEE_PCT,
    rem_max_percent: max ?? DEFAULT_REM_MAX_PERCENT,
    default_license_pct: lic ?? DEFAULT_LICENSE_PCT,
    default_hours_per_day: Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_HOURS_PER_DAY,
  };
  if (fee == null) return { ...values, error: 'company_fee_pct' };
  if (max == null) return { ...values, error: 'rem_max_percent' };
  if (lic == null) return { ...values, error: 'default_license_pct' };
  if (!Number.isFinite(hours) || hours <= 0) {
    return { ...values, error: 'hours' };
  }
  return values;
}

export function parseRemPolicy(value: string | null | undefined): RemPolicy {
  // external_tjm merged into staffing (enum label kept for DB compatibility).
  if (value === 'external_tjm') return 'staffing';
  if (value && (REM_POLICIES as string[]).includes(value)) return value as RemPolicy;
  return defaultRemPolicy();
}

export function parseRemKind(value: string | null | undefined): RemKind | null {
  if (!value) return null;
  if ((REM_KINDS as string[]).includes(value)) return value as RemKind;
  return null;
}

export type ProjectRemFields = {
  remPolicy: RemPolicy;
  remKind: RemKind | null;
  jungleFictitiousTjmCents: number | null;
};

export function validateProjectRemFields(fields: ProjectRemFields): string | null {
  if (remKindRequired(fields.remPolicy) && fields.remKind == null) {
    return 'rem_kind';
  }
  if (fields.remPolicy === 'jungle' && !isValidJungleTjm(fields.jungleFictitiousTjmCents)) {
    return 'jungle_tjm';
  }
  return null;
}

export function remBucketLabelKey(bucket: string): string {
  return `rem.bucket.${bucket}`;
}
