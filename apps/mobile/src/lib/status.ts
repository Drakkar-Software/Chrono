import type { BadgeStatus } from '@chrono/ui';
import type { InvoiceStatus, ProjectStatus, TimeEntryStatus } from '@chrono/sdk';

/** Map a time-entry status onto a Badge status token. */
export function timeEntryBadge(status: TimeEntryStatus): BadgeStatus {
  switch (status) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'pending':
    default:
      return 'warning';
  }
}

/** Map an invoice status onto a Badge status token. */
export function invoiceBadge(status: InvoiceStatus): BadgeStatus {
  switch (status) {
    case 'paid':
      return 'success';
    case 'partially_paid':
      return 'warning';
    case 'submitted':
      return 'info';
    case 'cancelled':
      return 'danger';
    case 'draft':
    default:
      return 'neutral';
  }
}

/** Map a project status onto a Badge status token. */
export function projectBadge(status: ProjectStatus): BadgeStatus {
  return status === 'active' ? 'success' : 'neutral';
}
