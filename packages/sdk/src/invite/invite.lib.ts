import type { CompanyInvite } from './invite.entity';

export type InviteState = 'pending' | 'accepted' | 'revoked' | 'expired';

const INVITE_STATE_ORDER: Record<InviteState, number> = {
  pending: 0,
  accepted: 1,
  expired: 2,
  revoked: 3,
};

/** Derive an invite's lifecycle state (checked in priority order). */
export function inviteState(
  invite: Pick<CompanyInvite, 'accepted_at' | 'revoked_at' | 'expires_at'>,
  nowISO: string,
): InviteState {
  if (invite.accepted_at) return 'accepted';
  if (invite.revoked_at) return 'revoked';
  if (invite.expires_at < nowISO) return 'expired';
  return 'pending';
}

/** Human label for an invite state. */
export function inviteStateLabel(state: InviteState): string {
  switch (state) {
    case 'accepted':
      return 'Accepted';
    case 'revoked':
      return 'Revoked';
    case 'expired':
      return 'Expired';
    default:
      return 'Pending';
  }
}

/** Whether an invite can still be redeemed. */
export function isInviteRedeemable(
  invite: Pick<CompanyInvite, 'accepted_at' | 'revoked_at' | 'expires_at'>,
  nowISO: string,
): boolean {
  return inviteState(invite, nowISO) === 'pending';
}

/**
 * Sort invites for manager UI: pending → accepted → expired → revoked.
 * Within the same state, newest `created_at` first.
 */
export function sortCompanyInvites<T extends Pick<CompanyInvite, 'accepted_at' | 'revoked_at' | 'expires_at' | 'created_at'>>(
  invites: readonly T[],
  nowISO: string,
): T[] {
  return [...invites].sort((a, b) => {
    const stateDiff = INVITE_STATE_ORDER[inviteState(a, nowISO)] - INVITE_STATE_ORDER[inviteState(b, nowISO)];
    if (stateDiff !== 0) return stateDiff;
    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  });
}

/** Classified invite / join failure for UI mapping. */
export type InviteErrorKind =
  | 'not_found'
  | 'revoked'
  | 'used'
  | 'expired'
  | 'unsigned'
  | 'seat_limit'
  | 'admin_role'
  | 'permission';

function extractErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return String(error);
}

/** Extract the token from a pasted invite link, or use the raw value as-is. */
export function tokenFromInput(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/[?&]token=([^&\s]+)/);
  return (match?.[1] ?? trimmed).trim();
}

/**
 * Map a thrown accept/join error to a stable kind. Returns null when unrecognized
 * so callers can fall back to a generic message.
 */
export function classifyInviteError(error: unknown): InviteErrorKind | null {
  const msg = extractErrorMessage(error).toLowerCase();
  if (!msg) return null;
  if (msg.includes('must be signed in')) return 'unsigned';
  if (msg.includes('invite not found')) return 'not_found';
  if (msg.includes('has been revoked')) return 'revoked';
  if (msg.includes('already been used')) return 'used';
  if (msg.includes('has expired')) return 'expired';
  if (msg.includes('seat limit')) return 'seat_limit';
  if (msg.includes('only an admin can grant or change the admin role')) return 'admin_role';
  if (
    msg.includes('only an admin can change your role') ||
    msg.includes('row-level security') ||
    msg.includes('permission denied') ||
    msg.includes('not authorized')
  ) {
    return 'permission';
  }
  return null;
}
