import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Card, Row, Txt, spacing } from '@chrono/ui';
import { formatDuration, summarizeByTag } from '@chrono/sdk';
import type { TimeEntryWithProject } from '@chrono/sdk';

import { useT } from '@/lib/i18n';

export interface TagBreakdownProps {
  entries: TimeEntryWithProject[];
}

/** Approved time grouped by tag (an entry with several tags counts under each). */
export function TagBreakdown({ entries }: TagBreakdownProps) {
  const t = useT();
  const rows = useMemo(() => {
    const summary = summarizeByTag(entries);
    return Object.entries(summary)
      .map(([tag, s]) => ({ tag, minutes: s.minutes, count: s.count }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [entries]);

  if (rows.length === 0) {
    return (
      <Card padding="lg">
        <Txt variant="caption" tone="textMuted">
          {t('compb.reports.noTaggedTime')}
        </Txt>
      </Card>
    );
  }

  return (
    <Card padding="lg" style={styles.card}>
      {rows.map((r) => (
        <Row key={r.tag} label={r.tag} value={`${formatDuration(r.minutes)} · ${r.count}`} />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
});
