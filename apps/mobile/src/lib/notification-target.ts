/**
 * Resolve the in-app route for a notification's `data` payload. Shared by the
 * notification feed (tap a row) and push handling (tap an OS notification) so
 * both navigate consistently.
 */
export function notificationTarget(data: unknown): string | null {
  const d = (data ?? {}) as { invoiceId?: string; projectId?: string };
  if (d.invoiceId) return `/invoice/${d.invoiceId}`;
  if (d.projectId) return `/project/${d.projectId}`;
  return null;
}
