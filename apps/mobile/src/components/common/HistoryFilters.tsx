import { StyleSheet, View } from 'react-native';
import { Picker, Segmented, Txt, spacing, useResponsive } from '@chrono/ui';
import type { Project, TimeEntryStatus } from '@chrono/sdk';

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

const RANGE_OPTIONS = [
  { label: 'This month', value: 'thisMonth' },
  { label: 'Last month', value: 'lastMonth' },
  { label: 'This week', value: 'thisWeek' },
  { label: 'All', value: 'all' },
];

const STATUS_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

const BILLABLE_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Billable', value: 'billable' },
  { label: 'Non-billable', value: 'nonBillable' },
];

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
  const { isWide } = useResponsive();
  const projectOptions = [
    { label: 'All projects', value: 'all' },
    ...projects.map((p) => ({ label: p.name, value: p.id })),
  ];

  return (
    <View style={styles.wrap}>
      <Picker
        label="Project"
        value={value.projectId}
        onValueChange={(projectId) => onChange({ ...value, projectId })}
        options={projectOptions}
      />

      <View style={[styles.controls, isWide && styles.controlsWide]}>
        <View style={styles.field}>
          <Txt variant="micro" mono uppercase tone="textMuted" style={styles.label}>
            Date range
          </Txt>
          <Segmented
            options={RANGE_OPTIONS}
            value={value.range}
            onValueChange={(range) => onChange({ ...value, range: range as HistoryRange })}
          />
        </View>

        <View style={styles.field}>
          <Txt variant="micro" mono uppercase tone="textMuted" style={styles.label}>
            Status
          </Txt>
          <Segmented
            options={STATUS_OPTIONS}
            value={value.status}
            onValueChange={(status) => onChange({ ...value, status: status as HistoryStatus })}
          />
        </View>

        <View style={styles.field}>
          <Txt variant="micro" mono uppercase tone="textMuted" style={styles.label}>
            Billable
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
