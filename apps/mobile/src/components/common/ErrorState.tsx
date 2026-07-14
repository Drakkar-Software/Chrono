import { StyleSheet, View } from 'react-native';
import { Button, EmptyState, Txt, spacing } from '@chrono/ui';

function extractMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return String(error);
}

function extractCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const c = (error as { code?: unknown }).code;
    if (typeof c === 'string') return c;
    if (typeof c === 'number') return String(c);
  }
  return '';
}

export interface DescribeErrorOptions {
  /** Message to use for a unique-violation (duplicate) error, e.g. 23505. */
  duplicateMessage?: string;
  /** Fallback for unrecognized errors. */
  fallback?: string;
}

/**
 * Map an unknown thrown value (Postgrest error, Error, string…) to a short,
 * user-facing message. Recognizes duplicate (23505) and RLS/permission (42501)
 * failures so denied writes read as a friendly message rather than vanishing.
 */
export function describeError(error: unknown, opts?: DescribeErrorOptions): string {
  const code = extractCode(error);
  const msg = extractMessage(error).toLowerCase();
  if (code === '23505' || msg.includes('duplicate')) {
    return opts?.duplicateMessage ?? 'That already exists.';
  }
  if (
    code === '42501' ||
    msg.includes('row-level security') ||
    msg.includes('permission denied') ||
    msg.includes('not authorized') ||
    msg.includes('rls')
  ) {
    return 'You do not have permission to do that.';
  }
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('offline')) {
    return 'Network problem. Check your connection and try again.';
  }
  return opts?.fallback ?? 'Something went wrong. Please try again.';
}

export interface ErrorStateProps {
  /** Raw error; used to derive the message when `message` is not provided. */
  error?: unknown;
  title?: string;
  message?: string;
  /** Optional retry handler — renders a "Try again" button. */
  onRetry?: () => void;
  /** Options forwarded to `describeError` when deriving the message. */
  describe?: DescribeErrorOptions;
}

/**
 * Full-block error state for a failed data load — distinct from loading and
 * empty. Built on `EmptyState` so failures read consistently with zero-data.
 */
export function ErrorState({
  error,
  title = 'Something went wrong',
  message,
  onRetry,
  describe,
}: ErrorStateProps) {
  return (
    <EmptyState
      icon="alert-circle-outline"
      title={title}
      subtitle={message ?? describeError(error, describe)}
      action={onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : undefined}
    />
  );
}

export interface InlineErrorProps {
  error?: unknown;
  message?: string;
  describe?: DescribeErrorOptions;
}

/**
 * Compact one-line error for surfacing a failed action right next to the
 * button that triggered it (e.g. generate/settle).
 */
export function InlineError({ error, message, describe }: InlineErrorProps) {
  const text = message ?? describeError(error, describe);
  if (!text) return null;
  return (
    <View style={styles.inline}>
      <Txt variant="caption" tone="danger">
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { paddingVertical: spacing.xs },
});
