import { StyleSheet, View } from 'react-native';
import { Picker, Segmented, Txt, spacing, useResponsive } from '@chrono/ui';
import type { Project, TimeEntryStatus } from '@chrono/sdk';

import { useT } from '@/lib/i18n';

/** Date-range preset keys resolved to `from`/`to` bounds by the screen. */
export type HistoryRange = 'thisMonth' | 'lastMonth' | 'thisWeek' | 'all';
/** Status filter — `'all'` means unfiltered. */
export type HistoryStatus = 'all' | TimeEntryStatus;
/** Billable filter — `'all'` means unfiltered. */
export type HistoryBillable = 'all' | 'billable' | 'nonBillable';

export interface HistoryFilterState {
  /** Selected project id, or `'all'`. */
  projectId: string;
  range: HistoryRange;
  status: HistoryStatus;
  billable: HistoryBillable;
}

/** The zeroed filter state (all projects, this month, any status/billable). */
export const DEFAULT_HISTORY_FILTERS: HistoryFilterState = {
  projectId: 'all',
  range: 'thisMonth',
  status: 'all',
  billable: 'all',
};

export interface HistoryFiltersProps {
  /** Projects the user can filter by (an "All" option is prepended). */
  projects: Project[];
  value: HistoryFilterState;
  onChange: (next: HistoryFilterState) => void;
}

/**
 * Filter bar for the time-history screen: project picker plus date-range,
 * status and billable segmented controls. Pure UI — it owns no state and
 * pushes every change back through `onChange`.
 */
export function HistoryFilters({ projects, value, onChange }: HistoryFiltersProps) {
  const t = useT();
  const { isWide } = useResponsive();

  const RANGE_OPTIONS = [
    { label: t('compb.history.thisMonth'), value: 'thisMonth' },
    { label: t('compb.history.lastMonth'), value: 'lastMonth' },
    { label: t('compb.history.thisWeek'), value: 'thisWeek' },
    { label: t('compb.history.all'), value: 'all' },
  ];

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

      <View style={[styles.controls, isWide && styles.controlsWide]}>
        <View style={styles.field}>
          <Txt variant="micro" mono uppercase tone="textMuted" style={styles.label}>
            {t('compb.history.dateRange')}
          </Txt>
          <Segmented
            options={RANGE_OPTIONS}
            value={value.range}
            onValueChange={(range) => onChange({ ...value, range: range as HistoryRange })}
          />
        </View>

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
