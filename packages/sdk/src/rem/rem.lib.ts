/**
 * Unified rem-engine pure math.
 *
 * Money is integer cents. Shares are fractions in [0, 1].
 * Rounding matches Postgres: Math.round at each money step.
 */

import { computeEarnedCents } from '../time-entry/time-entry.lib';
import type { PartnerShareInput, RemBucket, RemLinePreview } from './rem.entity';

const EPS = 1e-12;

/** Company fee (cents) on an eligible revenue base. */
export function companyFeeCents(revenueCents: number, feePct: number): number {
  if (revenueCents <= 0 || feePct <= 0) return 0;
  return Math.round((revenueCents * feePct) / 100);
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

/** Split `totalCents` by shares with Math.round; largest-remainder fix so sum matches. */
export function splitCentsByShares(
  totalCents: number,
  shares: Array<{ user_id: string; share: number }>,
): Array<{ user_id: string; amount_cents: number }> {
  if (shares.length === 0 || totalCents === 0) {
    return shares.map((s) => ({ user_id: s.user_id, amount_cents: 0 }));
  }
  const floored = shares.map((s) => {
    const exact = totalCents * s.share;
    const amount = Math.round(exact);
    return { user_id: s.user_id, amount_cents: amount, frac: exact - Math.floor(exact) };
  });
  let sum = floored.reduce((a, x) => a + x.amount_cents, 0);
  let diff = totalCents - sum;
  if (diff === 0) {
    return floored.map(({ user_id, amount_cents }) => ({ user_id, amount_cents }));
  }
  // Adjust by giving/taking 1 cent from partners with largest fractional parts
  const order = [...floored].sort((a, b) =>
    diff > 0 ? b.frac - a.frac : a.frac - b.frac,
  );
  let i = 0;
  while (diff !== 0 && order.length > 0) {
    const step = diff > 0 ? 1 : -1;
    order[i % order.length].amount_cents += step;
    diff -= step;
    i += 1;
    if (i > order.length * Math.abs(totalCents) + 10) break;
  }
  return floored.map(({ user_id, amount_cents }) => ({ user_id, amount_cents }));
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
  /** Partners who receive license 1/N (rem_partner). */
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
 *   license = (R − fee) × license%  → equal among license partners
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

/** External contract rem for one person on one contract (after referral cut on their days×TJM). */
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
  /** Days on external_tjm contracts this month. */
  contract_days: number;
  /** Contract rem cents after referral cuts (sum of externalContractRemCents.rem). */
  contract_rem_cents: number;
  /** Referral income earned as referrer this month. */
  referral_income_cents: number;
  /** Vacation days (count toward product pool weight). */
  vacation_days: number;
  /** Explicit product_pool / product_service logged days. */
  product_logged_days: number;
};

/**
 * Residual product-pool days for external_tjm partners:
 *   max(0, business_days - contract_days) + vacation_days + product_logged_days
 * (vacation already "fills" residual capacity — we add vacation explicitly when
 *  contract_days already excluded those calendar days from work; v1: add vacation
 *  and product logged days on top of residual capacity.)
 */
export function productPoolDaysForExternal(
  businessDays: number,
  contractDays: number,
  vacationDays: number,
  productLoggedDays: number,
): number {
  const residual = Math.max(0, businessDays - Math.max(0, contractDays));
  return residual + Math.max(0, vacationDays) + Math.max(0, productLoggedDays);
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
 * Dequeue FIFO **per user** on a project when `revenueCents` is available.
 * Entries must be pre-sorted by seq ascending within each user.
 */
export function dequeueJungleFifo(
  entries: JungleQueueSlice[],
  revenueCents: number,
): JungleDequeueResult {
  let left = Math.max(0, revenueCents);
  const remaining_by_id: Record<string, number> = {};
  const lines: RemLinePreview[] = [];

  // Group by user preserving seq order
  const byUser = new Map<string, JungleQueueSlice[]>();
  for (const e of [...entries].sort((a, b) => a.seq - b.seq)) {
    remaining_by_id[e.id] = e.remaining_cents;
    const list = byUser.get(e.user_id) ?? [];
    list.push(e);
    byUser.set(e.user_id, list);
  }

  // Split available revenue across users proportional to their remaining queue
  // v1: process users independently with equal claim on revenue in user-id order
  // when multiple users — allocate revenue round-robin by remaining until exhausted.
  // Simpler v1 from plan: independent FIFO per user sharing the same revenue pool
  // in sequence of first-seen user order.
  for (const [, userEntries] of byUser) {
    for (const e of userEntries) {
      if (left <= 0) break;
      const rem = remaining_by_id[e.id] ?? 0;
      if (rem <= 0) continue;
      const take = Math.min(rem, left);
      remaining_by_id[e.id] = rem - take;
      left -= take;
      if (take > 0) {
        lines.push({
          user_id: e.user_id,
          project_id: e.project_id,
          bucket: 'jungle_dequeue',
          amount_cents: take,
          meta: { queue_entry_id: e.id },
        });
      }
    }
  }

  return { remaining_by_id, lines, excess_revenue_cents: left };
}

/** Staffing TJM line — mirrors computeEarnedCents. */
export function staffingTjmRemCents(
  minutes: number,
  hoursPerDay: number,
  tjmCents: number,
): number {
  return computeEarnedCents(minutes, hoursPerDay, tjmCents);
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
