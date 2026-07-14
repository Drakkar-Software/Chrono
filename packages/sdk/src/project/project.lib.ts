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

export type BudgetStatus = 'none' | 'ok' | 'warning' | 'over';

export type BudgetUsage = {
  status: BudgetStatus;
  /** Fraction of the budget consumed (0..∞); 0 when there is no budget. */
  ratio: number;
  usedCents: number;
  budgetCents: number | null;
  remainingCents: number | null;
};

/**
 * Budget consumption for a project. `usedCents` is whatever the caller commits
 * against the budget (e.g. invoiced + earned). Warns at `warnAt` (default 80%)
 * and flags `over` past 100%. Projects without a budget cap are `none`.
 */
export function budgetUsage(
  project: Pick<Project, 'budget_cents'>,
  usedCents: number,
  warnAt = 0.8,
): BudgetUsage {
  const budgetCents = project.budget_cents;
  if (budgetCents == null || budgetCents <= 0) {
    return { status: 'none', ratio: 0, usedCents, budgetCents: budgetCents ?? null, remainingCents: null };
  }
  const ratio = usedCents / budgetCents;
  const status: BudgetStatus = ratio >= 1 ? 'over' : ratio >= warnAt ? 'warning' : 'ok';
  return {
    status,
    ratio,
    usedCents,
    budgetCents,
    remainingCents: budgetCents - usedCents,
  };
}
