import type { CompanyInvite } from './invite.entity';

export type InviteState = 'pending' | 'accepted' | 'revoked' | 'expired';

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
