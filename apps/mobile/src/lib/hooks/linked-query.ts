import { useLinkedQuery } from '@drakkar.software/anchor/hooks';

/**
 * Uniform result shape for every read hook. `error` is widened to `unknown`
 * (the app's ErrorState consumes it as unknown); anchor's own `Error | null`
 * is assignable to it, so no cast is needed at the call site.
 */
export type LinkedQueryResult<T> = {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<void>;
};

type LinkedQueryOptions<T> = Parameters<typeof useLinkedQuery<T>>[1];

/** Thin typed wrapper around anchor's useLinkedQuery — removes the per-hook cast. */
export function linkedQuery<T>(
  fn: () => Promise<T>,
  options: LinkedQueryOptions<T>,
): LinkedQueryResult<T> {
  return useLinkedQuery<T>(fn, options);
}
