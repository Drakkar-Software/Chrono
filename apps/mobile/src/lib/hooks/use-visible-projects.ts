import { canManage } from '@chrono/sdk';
import type { AppRole } from '@chrono/sdk';
import { useMyProjects, useProjects } from './use-projects';

/**
 * The projects a person should see: managers get the company's active
 * projects, freelancers get only the ones they're assigned to. Only one of
 * the two underlying queries is actually enabled per role.
 */
export function useVisibleProjects(
  role: AppRole | null,
  userId: string | undefined,
  companyId: string | undefined,
) {
  const manager = canManage(role);
  const mine = useMyProjects(!manager ? userId : undefined, !manager ? companyId : undefined);
  const managed = useProjects(manager ? companyId : undefined);
  return manager ? managed : mine;
}
