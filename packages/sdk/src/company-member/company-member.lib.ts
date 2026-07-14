import type { AppRole } from '../schema';

const ROLE_LABELS: Record<AppRole, string> = {
  freelancer: 'Freelancer',
  manager: 'Manager',
  admin: 'Admin',
};

export function roleLabel(role: AppRole): string {
  return ROLE_LABELS[role] ?? role;
}

/** Roles allowed to approve/reject time entries. */
export function canApprove(role: AppRole | null | undefined): boolean {
  return role === 'manager' || role === 'admin';
}

/** Roles allowed to manage projects, members and revenue. */
export function canManage(role: AppRole | null | undefined): boolean {
  return role === 'manager' || role === 'admin';
}
