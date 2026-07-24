import { StyleSheet, View } from 'react-native';
import { Money, Txt, spacing } from '@chrono/ui';
import { partnerTakeHomeCents, sumRemLinesByBucket, visibleRemLines } from '@chrono/sdk';
import type { RemLine } from '@chrono/sdk';
import { useT } from '@/lib/i18n';

export interface RemBreakdownProps {
  lines: RemLine[];
  currency: string;
  /** Optional map user_id → display name */
  names?: Record<string, string>;
}

/** Per-user take-home + bucket totals for a rem month. */
export function RemBreakdown({ lines, currency, names = {} }: RemBreakdownProps) {
  const t = useT();
  const preview = lines.map((l) => ({
    user_id: l.user_id ?? '',
    project_id: l.project_id,
    bucket: l.bucket,
    amount_cents: l.amount_cents,
  }));
  const visible = visibleRemLines(preview);
  const byBucket = sumRemLinesByBucket(preview);
  const userIds = [...new Set(visible.map((l) => l.user_id).filter(Boolean))];

  return (
    <View style={styles.wrap}>
      {userIds.map((uid) => (
        <View key={uid} style={styles.row}>
          <Txt variant="bodyMedium" style={styles.name}>
            {names[uid] ?? uid.slice(0, 8)}
          </Txt>
          <Money cents={partnerTakeHomeCents(preview, uid)} currency={currency} />
        </View>
      ))}
      {byBucket.company_fee ? (
        <View style={styles.row}>
          <Txt variant="caption" tone="textMuted">
            {t('rem.bucket.company_fee')}
          </Txt>
          <Money cents={byBucket.company_fee} currency={currency} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  name: { flex: 1 },
});
