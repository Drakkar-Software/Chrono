import type { ProjectStatus } from '../schema';
import type { Project } from './project.entity';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  archived: 'Archived',
};

export function projectStatusLabel(status: ProjectStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * Budget remaining after amounts already paid out.
 * Returns null when the project has no budget cap.
 */
export function remainingBudget(
  project: Pick<Project, 'budget_cents'>,
  paidToDateCents: number,
): number | null {
  if (project.budget_cents == null) return null;
  return project.budget_cents - paidToDateCents;
}
