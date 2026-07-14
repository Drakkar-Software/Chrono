import type { AuditEntry } from './audit.entity';

/** Ionicons glyph for an audit action. */
export function auditIcon(action: string): string {
  switch (action) {
    case 'role_changed':
      return 'people-outline';
    case 'invoice_settled':
      return 'cash-outline';
    case 'payment_recorded':
      return 'card-outline';
    default:
      return 'document-text-outline';
  }
}

/** One-line human summary of an audit entry from its detail payload. */
export function describeAudit(entry: Pick<AuditEntry, 'action' | 'detail'>): string {
  const d = (entry.detail ?? {}) as Record<string, unknown>;
  switch (entry.action) {
    case 'role_changed':
      return `Role changed from ${String(d.from ?? '?')} to ${String(d.to ?? '?')}`;
    case 'invoice_settled':
      return `Invoice ${String(d.period ?? '')} ${String(d.status ?? 'settled')}`;
    case 'payment_recorded':
      return `Payment recorded${d.method ? ` (${String(d.method)})` : ''}`;
    default:
      return entry.action;
  }
}

/** Title label for an audit action. */
export function auditActionLabel(action: string): string {
  switch (action) {
    case 'role_changed':
      return 'Role change';
    case 'invoice_settled':
      return 'Invoice settled';
    case 'payment_recorded':
      return 'Payment recorded';
    default:
      return action;
  }
}
