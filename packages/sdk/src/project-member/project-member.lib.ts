import type { Project } from '../project/project.entity';
import type { ProjectMember } from './project-member.entity';

/**
 * The day rate to bill a member at: their own rate, else the project default,
 * else zero.
 */
export function effectiveTjm(
  member: Pick<ProjectMember, 'tjm_cents'> | null | undefined,
  project: Pick<Project, 'default_tjm_cents'> | null | undefined,
): number {
  return member?.tjm_cents ?? project?.default_tjm_cents ?? 0;
}
