import { useMemo, useState } from 'react';

/** Items revealed per page — matches the repo's documented list-pagination rule. */
export const PAGE_SIZE = 20;

export interface Pagination<T> {
  /** The visible slice: `items.slice(0, displayCount)`. */
  page: T[];
  /** True while more items remain to reveal. */
  hasMore: boolean;
  /** Reveal the next `PAGE_SIZE` items (no-op when exhausted). */
  loadMore: () => void;
  /** Snap back to the first page. */
  reset: () => void;
}

/**
 * Client-side "reveal in pages of {@link PAGE_SIZE}" pagination over an
 * already-loaded array. Keeps long tab/history lists from mounting every row
 * at once. Pass a `resetKey` (a stable primitive derived from the active
 * filters/tab/search) so the visible window collapses back to the first page
 * whenever the underlying query changes.
 */
export function usePagination<T>(items: T[], resetKey?: string | number): Pagination<T> {
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Collapse to the first page when the caller's filter identity changes.
  // Tracking the previous key in state and adjusting during render is the
  // documented React pattern for deriving state from props — it avoids the
  // extra render an effect would cause.
  const [prevKey, setPrevKey] = useState(resetKey);
  if (prevKey !== resetKey) {
    setPrevKey(resetKey);
    setDisplayCount(PAGE_SIZE);
  }

  const page = useMemo(() => items.slice(0, displayCount), [items, displayCount]);
  const hasMore = displayCount < items.length;

  return {
    page,
    hasMore,
    loadMore: () => setDisplayCount((prev) => (prev < items.length ? prev + PAGE_SIZE : prev)),
    reset: () => setDisplayCount(PAGE_SIZE),
  };
}
