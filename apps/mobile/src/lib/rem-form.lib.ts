import {
  clampPct,
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
  default_hours_per_day: number | null;
  error?: string;
};

/** Parse company rem settings fields; clamps percents to 0–100. */
export function parseRemSettings(input: RemSettingsInput): RemSettingsParsed {
  const fee = clampPct(Number(input.companyFeePct.replace(',', '.')) || 0);
  const max = clampPct(Number(input.remMaxPercent.replace(',', '.')) || 100);
  const lic = clampPct(Number(input.defaultLicensePct.replace(',', '.')) || 0);
  let hours: number | null = null;
  if (input.defaultHoursPerDay.trim() !== '') {
    const h = Number(input.defaultHoursPerDay.replace(',', '.'));
    if (!Number.isFinite(h) || h <= 0) {
      return {
        company_fee_pct: fee,
        rem_max_percent: max,
        default_license_pct: lic,
        default_hours_per_day: null,
        error: 'hours',
      };
    }
    hours = h;
  }
  return {
    company_fee_pct: fee,
    rem_max_percent: max,
    default_license_pct: lic,
    default_hours_per_day: hours,
  };
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
