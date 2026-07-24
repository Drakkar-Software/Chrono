import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Button, EmptyState, StackScreen, TextField, TitledCard, Txt, spacing } from '@chrono/ui';
import { canManage, companyCurrency, displayName, monthKey } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { todayISO } from '@/lib/date';
import { useCompanyMembers } from '@/lib/hooks/use-company-members';
import {
  useCompanyFeeReserve,
  useRemLines,
  useRemMonth,
  useRemMutations,
} from '@/lib/hooks/use-rem';
import { RemBreakdown } from '@/components/reports/RemBreakdown';
import { InlineError } from '@/components/common/ErrorState';
import { ScreenLoader } from '@/components/common/ScreenLoader';

export default function RemMonthScreen() {
  const t = useT();
  const { companyId, company, role } = useActiveCompany();
  const currency = companyCurrency(company);
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const { data: remMonth, refetch: refetchMonth, isLoading } = useRemMonth(
    companyId ?? undefined,
    month,
  );
  const { data: lines, refetch: refetchLines } = useRemLines(remMonth?.id);
  const { data: reserve } = useCompanyFeeReserve(companyId ?? undefined, month);
  const { data: members } = useCompanyMembers(companyId ?? undefined);
  const { compute, lock } = useRemMutations();

  const names = useMemo(() => {
    const out: Record<string, string> = {};
    for (const m of members ?? []) {
      out[m.user_id] = displayName(m.profile);
    }
    return out;
  }, [members]);

  if (!canManage(role)) return <Redirect href="/(app)/(tabs)/home" />;

  const onCompute = async () => {
    if (!companyId) return;
    setBusy(true);
    setError(undefined);
    try {
      await compute(companyId, month);
      await refetchMonth();
      await refetchLines();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rem.computeFail'));
    } finally {
      setBusy(false);
    }
  };

  const onLock = async () => {
    if (!companyId) return;
    setBusy(true);
    setError(undefined);
    try {
      await lock(companyId, month);
      await refetchMonth();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rem.lockFail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <StackScreen title={t('rem.screen.title')}>
      <View style={styles.wrap}>
        <TextField
          label={t('rem.screen.month')}
          value={month.slice(0, 7)}
          onChangeText={(v) => {
            const m = v.trim();
            if (/^\d{4}-\d{2}$/.test(m)) setMonth(`${m}-01`);
          }}
          placeholder="YYYY-MM"
        />
        <View style={styles.actions}>
          <Button
            title={t('rem.screen.compute')}
            onPress={onCompute}
            loading={busy}
            disabled={remMonth?.status === 'locked'}
          />
          <Button
            title={t('rem.screen.lock')}
            variant="secondary"
            onPress={onLock}
            loading={busy}
            disabled={!remMonth || remMonth.status === 'locked'}
          />
        </View>
        {error ? <InlineError message={error} /> : null}
        {isLoading ? <ScreenLoader fill={false} /> : null}
        <TitledCard title={t('rem.screen.breakdown')}>
          <Txt variant="caption" tone="textMuted">
            {t('rem.screen.status')}: {remMonth?.status ?? t('common.noneYet')}
          </Txt>
          {(lines ?? []).length === 0 ? (
            <EmptyState
              icon="calculator-outline"
              title={t('rem.screen.empty')}
              subtitle={t('rem.screen.emptySubtitle')}
            />
          ) : (
            <RemBreakdown lines={lines ?? []} currency={currency} names={names} />
          )}
        </TitledCard>
        {(reserve ?? []).length > 0 ? (
          <TitledCard title={t('rem.screen.feeReserve')}>
            <Txt>
              {t('rem.screen.feeReserveAmount')}:{' '}
              {((reserve?.[0]?.amount_cents ?? 0) / 100).toFixed(2)} {currency}
            </Txt>
          </TitledCard>
        ) : null}
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, paddingBottom: spacing.xl },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
