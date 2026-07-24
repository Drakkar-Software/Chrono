import { StyleSheet, View } from 'react-native';
import { Picker, Segmented, Txt, spacing, useResponsive } from '@chrono/ui';
import type { Project, TimeEntryStatus } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { currentMonthKey, type HistoryPeriod } from '@/lib/history-range';
import { PeriodMonthRail } from '@/components/reports/PeriodMonthRail';

/** Status filter — `'all'` means unfiltered. */
export type HistoryStatus = 'all' | TimeEntryStatus;
/** Billable filter — `'all'` means unfiltered. */
export type HistoryBillable = 'all' | 'billable' | 'nonBillable';

export type { HistoryPeriod };

export interface HistoryFilterState {
  /** Selected project id, or `'all'`. */
  projectId: string;
  /** All, this week, or a calendar month `'YYYY-MM'`. */
  range: HistoryPeriod;
  status: HistoryStatus;
  billable: HistoryBillable;
}

/** Default filters: all projects, current calendar month, any status/billable. */
export function defaultHistoryFilters(todayISO?: string): HistoryFilterState {
  return {
    projectId: 'all',
    range: currentMonthKey(todayISO),
    status: 'all',
    billable: 'all',
  };
}

/** @deprecated Prefer {@link defaultHistoryFilters} so the month key is evaluated at use time. */
export const DEFAULT_HISTORY_FILTERS: HistoryFilterState = defaultHistoryFilters();

export interface HistoryFiltersProps {
  /** Projects the user can filter by (an "All" option is prepended). */
  projects: Project[];
  value: HistoryFilterState;
  onChange: (next: HistoryFilterState) => void;
}

/**
 * Filter bar for the time-history screen: project picker, ledger period rail
 * (All / this week / months), status and billable segmented controls.
 */
export function HistoryFilters({ projects, value, onChange }: HistoryFiltersProps) {
  const t = useT();
  const { isWide } = useResponsive();

  const STATUS_OPTIONS = [
    { label: t('compb.history.all'), value: 'all' },
    { label: t('status.pending'), value: 'pending' },
    { label: t('status.approved'), value: 'approved' },
    { label: t('status.rejected'), value: 'rejected' },
  ];

  const BILLABLE_OPTIONS = [
    { label: t('compb.history.all'), value: 'all' },
    { label: t('compb.history.billable'), value: 'billable' },
    { label: t('compb.history.nonBillable'), value: 'nonBillable' },
  ];

  const projectOptions = [
    { label: t('compb.history.allProjects'), value: 'all' },
    ...projects.map((p) => ({ label: p.name, value: p.id })),
  ];

  return (
    <View style={styles.wrap}>
      <Picker
        label={t('compb.history.project')}
        value={value.projectId}
        onValueChange={(projectId) => onChange({ ...value, projectId })}
        options={projectOptions}
      />

      <PeriodMonthRail
        value={value.range}
        onChange={(range) => onChange({ ...value, range })}
        showThisWeek
        eyebrowKey="compb.history.dateRange"
      />

      <View style={[styles.controls, isWide && styles.controlsWide]}>
        <View style={styles.field}>
          <Txt variant="micro" mono uppercase tone="textMuted" style={styles.label}>
            {t('common.status')}
          </Txt>
          <Segmented
            options={STATUS_OPTIONS}
            value={value.status}
            onValueChange={(status) => onChange({ ...value, status: status as HistoryStatus })}
          />
        </View>

        <View style={styles.field}>
          <Txt variant="micro" mono uppercase tone="textMuted" style={styles.label}>
            {t('compb.history.billable')}
          </Txt>
          <Segmented
            options={BILLABLE_OPTIONS}
            value={value.billable}
            onValueChange={(billable) =>
              onChange({ ...value, billable: billable as HistoryBillable })
            }
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  controls: { gap: spacing.md },
  controlsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  field: { flexGrow: 1, minWidth: 220, gap: spacing.xs },
  label: { letterSpacing: 1 },
});
