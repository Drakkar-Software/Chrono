/**
 * Unified rem-engine domain types — re-export schema enums + preview shapes.
 */

export type {
  RemPolicy,
  RemKind,
  RemBucket,
  RemMonthStatus,
} from '../schema';
export { REM_POLICIES, REM_KINDS, REM_BUCKETS } from './rem.constants';

/** Preview / computed rem line (before or after DB persist). */
export type RemLinePreview = {
  user_id: string;
  project_id: string | null;
  bucket: import('../schema').RemBucket;
  amount_cents: number;
  meta?: Record<string, unknown>;
};

export type PartnerShareInput = {
  user_id: string;
  /** Raw time weight (days or minutes); normalized internally. */
  time_weight: number;
  /** Cap as fraction 0–1; defaults to company max. */
  max_fraction?: number;
  rem_partner?: boolean;
};
