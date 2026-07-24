import type { RemBucket, RemKind, RemPolicy } from '../schema';

export const REM_POLICIES: RemPolicy[] = [
  'staffing',
  'product_pool',
  'product_service',
  'jungle',
];

export const REM_KINDS: RemKind[] = [
  'direct_sales',
  'maintenance',
  'product_service',
  'license',
];

export const REM_BUCKETS: RemBucket[] = [
  'staffing_tjm',
  'external_contract',
  'product_pool',
  'product_service',
  'license',
  'referral',
  'jungle_dequeue',
  'company_fee',
  'leave_product_pool',
];
