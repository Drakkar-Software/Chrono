import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tiny mutation-shaped wrapper for one-off async actions (RPCs, composite SDK
 * calls) that don't map cleanly onto a single anchor store mutation. Mirrors
 * the `{ mutate, mutateAsync, isPending, error }` shape the app's hooks expose.
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  }, [fn]);
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const mutateAsync = useCallback(async (...args: TArgs): Promise<TResult> => {
    setPending(true);
    setError(null);
    try {
      return await ref.current(...args);
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setPending(false);
    }
  }, []);

  const mutate = useCallback(
    (...args: TArgs) => {
      mutateAsync(...args).catch(() => {});
    },
    [mutateAsync],
  );

  return { mutate, mutateAsync, isPending, error };
}
