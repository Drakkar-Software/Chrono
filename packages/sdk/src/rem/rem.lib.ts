/**
 * Unified rem-engine pure math.
 *
 * Money is integer cents. Shares are fractions in [0, 1].
 * Rounding matches Postgres: Math.round at each money step.
 */

import { DEFAULT_COMPANY_FEE_PCT } from '../constants';
import { computeEarnedCents } from '../time-entry/time-entry.lib';
import type { PartnerShareInput, RemBucket, RemLinePreview } from './rem.entity';

const EPS = 1e-12;

/** Company fee (cents) on an eligible revenue base. */
export function companyFeeCents(revenueCents: number, feePct: number): number {
  if (revenueCents <= 0 || feePct <= 0) return 0;
  return Math.round((revenueCents * feePct) / 100);
}

export type GlobalCompanyFeeResult = {
  gross_cents: number;
  company_fee_cents: number;
  net_cents: number;
};

/**
 * Apply the global company fee to any revenue policy, including staffing and
 * jungle, while deriving the net as the exact remainder.
 */
export function applyGlobalCompanyFee(
  revenueCents: number,
  feePct = DEFAULT_COMPANY_FEE_PCT,
): GlobalCompanyFeeResult {
  const gross = Math.max(0, Math.round(revenueCents));
  const fee = companyFeeCents(gross, clampPct(feePct));
  return {
    gross_cents: gross,
    company_fee_cents: fee,
    net_cents: gross - fee,
  };
}

/**
 * Cap time shares so each partner is at most `maxFraction` (company or
 * per-member). Excess is redistributed to uncapped partners proportional to
 * their raw TP. If everyone is at the cap, shares are scaled to sum 1.
 *
 * Zero total weight → equal split among inputs (avoids div-by-zero).
 */
export function cappedTimeShares(
  partners: PartnerShareInput[],
  defaultMaxFraction: number,
): Array<{ user_id: string; share: number }> {
  if (partners.length === 0) return [];

  const maxFor = (p: PartnerShareInput) => {
    const m = p.max_fraction ?? defaultMaxFraction;
    return Math.min(1, Math.max(0, m));
  };

  const totalWeight = partners.reduce((s, p) => s + Math.max(0, p.time_weight), 0);
  let shares = partners.map((p) => ({
    user_id: p.user_id,
    raw: totalWeight > 0 ? Math.max(0, p.time_weight) / totalWeight : 1 / partners.length,
    max: maxFor(p),
    share: 0,
  }));

  // Initialize from raw
  for (const s of shares) s.share = s.raw;

  // Iterative cap + redistribute (bounded iterations)
  for (let iter = 0; iter < 32; iter++) {
    let excess = 0;
    const uncapped: typeof shares = [];
    for (const s of shares) {
      if (s.share > s.max + EPS) {
        excess += s.share - s.max;
        s.share = s.max;
      } else if (s.share < s.max - EPS) {
        uncapped.push(s);
      }
    }
    if (excess <= EPS) break;
    if (uncapped.length === 0) {
      // Everyone hit cap — scale to sum 1
      const sum = shares.reduce((a, s) => a + s.share, 0);
      if (sum > 0) for (const s of shares) s.share /= sum;
      break;
    }
    const uncappedRaw = uncapped.reduce((a, s) => a + s.raw, 0);
    if (uncappedRaw <= EPS) {
      const each = excess / uncapped.length;
      for (const s of uncapped) s.share += each;
    } else {
      for (const s of uncapped) s.share += excess * (s.raw / uncappedRaw);
    }
  }

  // Final normalize for floating error
  const sum = shares.reduce((a, s) => a + s.share, 0);
  if (sum > 0 && Math.abs(sum - 1) > EPS) {
    for (const s of shares) s.share /= sum;
  }

  return shares.map((s) => ({ user_id: s.user_id, share: s.share }));
}

/**
 * Split integer cents using normalized non-negative shares and the largest
 * remainder method. Equal remainders are resolved by `user_id`, so allocation
 * is deterministic regardless of input order.
 */
export function splitCentsByShares(
  totalCents: number,
  shares: Array<{ user_id: string; share: number }>,
): Array<{ user_id: string; amount_cents: number }> {
  if (shares.length === 0) return [];

  const target = Number.isFinite(totalCents) ? Math.round(totalCents) : 0;
  if (target === 0) {
    return shares.map((s) => ({ user_id: s.user_id, amount_cents: 0 }));
  }

  const sign = target < 0 ? -1 : 1;
  const absoluteTarget = Math.abs(target);
  const weights = shares.map((s) =>
    Number.isFinite(s.share) ? Math.max(0, s.share) : 0,
  );
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const normalizedWeights =
    weightTotal > 0
      ? weights.map((weight) => weight / weightTotal)
      : weights.map(() => 1 / weights.length);

  const allocations = shares.map((s, index) => {
    const exact = absoluteTarget * normalizedWeights[index];
    const amount = Math.floor(exact);
    return {
      index,
      user_id: s.user_id,
      amount_cents: amount,
      remainder: exact - amount,
    };
  });

  const allocated = allocations.reduce((sum, item) => sum + item.amount_cents, 0);
  const remainderOrder = [...allocations].sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > EPS) {
      return b.remainder - a.remainder;
    }
    if (a.user_id < b.user_id) return -1;
    if (a.user_id > b.user_id) return 1;
    return a.index - b.index;
  });
  const centsLeft = absoluteTarget - allocated;
  for (let i = 0; i < centsLeft; i++) {
    remainderOrder[i % remainderOrder.length].amount_cents += 1;
  }

  return allocations.map(({ user_id, amount_cents }) => ({
    user_id,
    amount_cents: amount_cents * sign,
  }));
}

/** Equal 1/N split among partner ids (largest remainder). */
export function equalSplitCents(
  totalCents: number,
  partnerIds: string[],
): Array<{ user_id: string; amount_cents: number }> {
  if (partnerIds.length === 0) return [];
  const shares = partnerIds.map((user_id) => ({
    user_id,
    share: 1 / partnerIds.length,
  }));
  return splitCentsByShares(totalCents, shares);
}

export type ProductPoolInput = {
  direct_sales_cents: number;
  maintenance_cents: number;
  costs_cents: number;
  company_fee_pct: number;
  partners: PartnerShareInput[];
  default_max_fraction: number;
};

export type ProductPoolResult = {
  gross_cents: number;
  company_fee_cents: number;
  net_cents: number;
  shares: Array<{ user_id: string; share: number }>;
  lines: RemLinePreview[];
};

/**
 * Product pool rem: capped TP × (direct + maintenance − costs − company fee).
 * Referrals are intentionally ignored.
 */
export function computeProductPoolRem(input: ProductPoolInput): ProductPoolResult {
  const gross = Math.max(0, input.direct_sales_cents) + Math.max(0, input.maintenance_cents);
  const afterCosts = Math.max(0, gross - Math.max(0, input.costs_cents));
  // Fee applies to (gross − costs), matching (R − costs) × (1 − fee%).
  const fee = companyFeeCents(afterCosts, input.company_fee_pct);
  const net = Math.max(0, afterCosts - fee);
  const shares = cappedTimeShares(input.partners, input.default_max_fraction);
  const splits = splitCentsByShares(net, shares);
  const lines: RemLinePreview[] = splits
    .filter((s) => s.amount_cents !== 0)
    .map((s) => ({
      user_id: s.user_id,
      project_id: null,
      bucket: 'product_pool' as RemBucket,
      amount_cents: s.amount_cents,
      meta: {
        share: shares.find((x) => x.user_id === s.user_id)?.share,
        net_cents: net,
        company_fee_cents: fee,
        gross_cents: gross,
      },
    }));
  if (fee > 0) {
    lines.push({
      user_id: '',
      project_id: null,
      bucket: 'company_fee',
      amount_cents: fee,
      meta: { gross_cents: gross, fee_pct: input.company_fee_pct },
    });
  }
  return { gross_cents: gross, company_fee_cents: fee, net_cents: net, shares, lines };
}

export type ProductServiceInput = {
  revenue_cents: number;
  company_fee_pct: number;
  license_pct: number;
  referral_pct: number;
  /** Referrer user ids sharing referral_pct (single or multi). */
  referrer_user_ids: string[];
  /** Time weights for service pool (all contributors). */
  time_partners: PartnerShareInput[];
  /**
   * License recipients are separate from time/rem partners. The authoritative
   * DB policy requires exactly two recipients; the pure split remains N-way.
   */
  license_partner_ids: string[];
  project_id?: string | null;
};

export type ProductServiceResult = {
  fee_cents: number;
  license_cents: number;
  referral_cents: number;
  pool_cents: number;
  lines: RemLinePreview[];
};

/**
 * Product service rem:
 *   fee = R × fee%
 *   license = (R − fee) × license%  → equal among separate license recipients
 *   referral = R × referral%        → referrers
 *   pool = R − fee − license − referral → by TP
 */
export function computeProductServiceRem(input: ProductServiceInput): ProductServiceResult {
  const R = Math.max(0, input.revenue_cents);
  const fee = companyFeeCents(R, input.company_fee_pct);
  const afterFee = R - fee;
  const license = Math.round((afterFee * Math.max(0, input.license_pct)) / 100);
  const referral = Math.round((R * Math.max(0, input.referral_pct)) / 100);
  const pool = Math.max(0, R - fee - license - referral);
  const project_id = input.project_id ?? null;
  const lines: RemLinePreview[] = [];

  const timeShares = cappedTimeShares(input.time_partners, 1); // no max on service TP
  for (const s of splitCentsByShares(pool, timeShares)) {
    if (s.amount_cents === 0) continue;
    lines.push({
      user_id: s.user_id,
      project_id,
      bucket: 'product_service',
      amount_cents: s.amount_cents,
      meta: { pool_cents: pool, fee_cents: fee, license_cents: license, referral_cents: referral },
    });
  }

  for (const s of equalSplitCents(license, input.license_partner_ids)) {
    if (s.amount_cents === 0) continue;
    lines.push({
      user_id: s.user_id,
      project_id,
      bucket: 'license',
      amount_cents: s.amount_cents,
      meta: { license_cents: license, partners: input.license_partner_ids.length },
    });
  }

  if (referral > 0 && input.referrer_user_ids.length > 0) {
    for (const s of equalSplitCents(referral, input.referrer_user_ids)) {
      if (s.amount_cents === 0) continue;
      lines.push({
        user_id: s.user_id,
        project_id,
        bucket: 'referral',
        amount_cents: s.amount_cents,
        meta: { referral_cents: referral },
      });
    }
  }

  if (fee > 0) {
    lines.push({
      user_id: '',
      project_id,
      bucket: 'company_fee',
      amount_cents: fee,
      meta: { revenue_cents: R, fee_pct: input.company_fee_pct },
    });
  }

  return {
    fee_cents: fee,
    license_cents: license,
    referral_cents: referral,
    pool_cents: pool,
    lines,
  };
}

export type ExternalContractInput = {
  project_id: string;
  days: number;
  tjm_cents: number;
  /** Referral pct taken off this contract (0–100). */
  referral_pct: number;
  user_id: string;
};

/** Staffing TJM rem: days × TJM, minus referral carve-out when `referralPct` > 0. */
export function staffingTjmRemCents(
  minutes: number,
  hoursPerDay: number,
  tjmCents: number,
  referralPct = 0,
): number {
  const gross = computeEarnedCents(minutes, hoursPerDay, tjmCents);
  if (!(referralPct > 0) || gross === 0) return gross;
  const cut = Math.round((gross * referralPct) / 100);
  return gross - cut;
}

/**
 * @deprecated Prefer {@link staffingTjmRemCents} — external_tjm is merged into staffing.
 * Kept for residual product-pool helpers / tests that still speak in "contract days".
 */
export function externalContractRemCents(input: ExternalContractInput): {
  gross_cents: number;
  rem_cents: number;
  referral_base_cents: number;
} {
  const gross = Math.round(input.days * input.tjm_cents);
  const referral_base = Math.round((gross * Math.max(0, input.referral_pct)) / 100);
  const rem = gross - referral_base;
  return { gross_cents: gross, rem_cents: rem, referral_base_cents: referral_base };
}

export type ExternalMonthPartner = {
  user_id: string;
  /** Days on staffing / contract work this month (reduces residual product weight). */
  contract_days: number;
  /** Contract rem cents after referral cuts (sum of staffing/external contract rem). */
  contract_rem_cents: number;
  /** Referral income earned as referrer this month. */
  referral_income_cents: number;
  /** Vacation days (count toward product pool weight). */
  vacation_days: number;
  /** Explicit product_pool / product_service logged days. */
  product_logged_days: number;
};

/**
 * Residual product-pool days for staffing partners with contract load.
 * The fixed capacity baseline already includes vacation and product days, so
 * those informational inputs must not be added again:
 *   max(0, min(capacity, capacity - contract_days))
 */
export function productPoolDaysForExternal(
  capacityDays: number,
  contractDays: number,
  _vacationDays: number,
  _productLoggedDays: number,
): number {
  const capacity = Number.isFinite(capacityDays) ? Math.max(0, capacityDays) : 0;
  const contracts = Number.isFinite(contractDays) ? Math.max(0, contractDays) : 0;
  return Math.max(0, Math.min(capacity, capacity - contracts));
}

export type ExternalMonthInput = {
  business_days: number;
  partners: ExternalMonthPartner[];
  product_net_cents: number;
  default_max_fraction: number;
};

/**
 * External TJM month: contract rem + referral income + residual share of product net.
 */
export function computeExternalTjmMonth(input: ExternalMonthInput): RemLinePreview[] {
  const lines: RemLinePreview[] = [];
  const weights: PartnerShareInput[] = input.partners.map((p) => ({
    user_id: p.user_id,
    time_weight: productPoolDaysForExternal(
      input.business_days,
      p.contract_days,
      p.vacation_days,
      p.product_logged_days,
    ),
    max_fraction: input.default_max_fraction,
    rem_partner: true,
  }));

  for (const p of input.partners) {
    if (p.contract_rem_cents !== 0) {
      lines.push({
        user_id: p.user_id,
        project_id: null,
        bucket: 'external_contract',
        amount_cents: p.contract_rem_cents,
        meta: { contract_days: p.contract_days },
      });
    }
    if (p.referral_income_cents !== 0) {
      lines.push({
        user_id: p.user_id,
        project_id: null,
        bucket: 'referral',
        amount_cents: p.referral_income_cents,
      });
    }
    if (p.vacation_days > 0) {
      lines.push({
        user_id: p.user_id,
        project_id: null,
        bucket: 'leave_product_pool',
        amount_cents: 0,
        meta: { vacation_days: p.vacation_days, note: 'weight_only' },
      });
    }
  }

  const shares = cappedTimeShares(weights, input.default_max_fraction);
  for (const s of splitCentsByShares(Math.max(0, input.product_net_cents), shares)) {
    if (s.amount_cents === 0) continue;
    lines.push({
      user_id: s.user_id,
      project_id: null,
      bucket: 'product_pool',
      amount_cents: s.amount_cents,
      meta: {
        residual: true,
        share: shares.find((x) => x.user_id === s.user_id)?.share,
      },
    });
  }

  return lines;
}

// --- Jungle queue ----------------------------------------------------------------

export type JungleQueueSlice = {
  id: string;
  user_id: string;
  project_id: string;
  queued_cents: number;
  remaining_cents: number;
  /** Stable FIFO order (lower first). */
  seq: number;
};

export function enqueueJungleCents(days: number, fictitiousTjmCents: number): number {
  if (days <= 0 || fictitiousTjmCents <= 0) return 0;
  return Math.round(days * fictitiousTjmCents);
}

export type JungleDequeueResult = {
  /** Updated remaining per entry id. */
  remaining_by_id: Record<string, number>;
  /** Rem lines created. */
  lines: RemLinePreview[];
  /** Revenue not applied (excess). */
  excess_revenue_cents: number;
};

/**
 * Dequeue one global FIFO on a project when `revenueCents` is available.
 * Lower `seq` wins globally; equal sequences are resolved by entry `id`.
 * When `feePct` is set, only the post-fee net funds the queue.
 */
export function dequeueJungleFifo(
  entries: JungleQueueSlice[],
  revenueCents: number,
  feePct = 0,
): JungleDequeueResult {
  const { net_cents } = applyGlobalCompanyFee(revenueCents, feePct);
  let left = Math.max(0, net_cents);
  const remaining_by_id: Record<string, number> = {};
  const lines: RemLinePreview[] = [];

  const ordered = [...entries].sort((a, b) => {
    if (a.seq !== b.seq) return a.seq - b.seq;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
  for (const entry of ordered) {
    remaining_by_id[entry.id] = Math.max(0, entry.remaining_cents);
  }

  for (const entry of ordered) {
    if (left <= 0) break;
    const remaining = remaining_by_id[entry.id] ?? 0;
    if (remaining <= 0) continue;
    const take = Math.min(remaining, left);
    remaining_by_id[entry.id] = remaining - take;
    left -= take;
    lines.push({
      user_id: entry.user_id,
      project_id: entry.project_id,
      bucket: 'jungle_dequeue',
      amount_cents: take,
      meta: { queue_entry_id: entry.id },
    });
    }

  return { remaining_by_id, lines, excess_revenue_cents: left };
}

/** Vacation day fraction from time_off: null duration = full day. */
export function vacationDaysFromTimeOff(
  kind: string,
  durationMinutes: number | null,
  hoursPerDay: number,
): number {
  if (kind !== 'vacation') return 0;
  if (durationMinutes == null) return 1;
  if (!hoursPerDay || hoursPerDay <= 0) return 0;
  return durationMinutes / (hoursPerDay * 60);
}

// --- Aggregates ------------------------------------------------------------------

export function sumRemLinesByUser(
  lines: RemLinePreview[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of lines) {
    if (!l.user_id || l.bucket === 'company_fee') continue;
    out[l.user_id] = (out[l.user_id] ?? 0) + l.amount_cents;
  }
  return out;
}

export function sumRemLinesByBucket(
  lines: RemLinePreview[],
): Partial<Record<RemBucket, number>> {
  const out: Partial<Record<RemBucket, number>> = {};
  for (const l of lines) {
    out[l.bucket] = (out[l.bucket] ?? 0) + l.amount_cents;
  }
  return out;
}

/** Partner take-home: all buckets except company_fee. */
export function partnerTakeHomeCents(lines: RemLinePreview[], userId: string): number {
  return lines
    .filter((l) => l.user_id === userId && l.bucket !== 'company_fee')
    .reduce((s, l) => s + l.amount_cents, 0);
}

/** Hide zero-amount lines for UI (except weight-only leave markers if desired). */
export function visibleRemLines(lines: RemLinePreview[]): RemLinePreview[] {
  return lines.filter((l) => l.amount_cents !== 0);
}

/** Clamp a percent to [0, 100]. */
export function clampPct(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** Validate jungle fictitious TJM (cents); null/negative invalid. */
export function isValidJungleTjm(cents: number | null | undefined): boolean {
  return cents != null && Number.isFinite(cents) && cents > 0;
}

/** rem_kind required for product_pool / product_service policies. */
export function remKindRequired(policy: string): boolean {
  return policy === 'product_pool' || policy === 'product_service';
}

export function defaultRemPolicy(): 'staffing' {
  return 'staffing';
}

/** Compare rem line sets order-independently (for idempotency tests). */
export function remLinesFingerprint(lines: RemLinePreview[]): string {
  return [...lines]
    .map(
      (l) =>
        `${l.user_id}|${l.project_id ?? ''}|${l.bucket}|${l.amount_cents}`,
    )
    .sort()
    .join(';');
}
