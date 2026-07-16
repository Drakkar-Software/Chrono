import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Badge, Card, Row, StackScreen, Txt, spacing } from '@chrono/ui';
import type { BadgeStatus } from '@chrono/ui';

import { useT } from '@/lib/i18n';
import { useActiveCompany } from '@/lib/active-company-context';
import { useChronoPro } from '@/lib/hooks/use-subscription';
import { PaywallBody } from '@/components/billing/PaywallBody';

const STATUS_TONE: Record<string, BadgeStatus> = {
  trialing: 'info',
  active: 'success',
  past_due: 'warning',
  canceled: 'neutral',
  expired: 'danger',
};

export default function BillingSettingsScreen() {
  const t = useT();
  const router = useRouter();
  const { company, companyId, role } = useActiveCompany();
  const { sub, seatCount, seatLimit, trialDaysLeft } = useChronoPro(companyId ?? undefined);

  if (!company) return <Redirect href="/settings" />;

  return (
    <StackScreen title={t('tabs.settings.billing')} onBack={() => router.back()}>
      <View style={styles.wrap}>
        {sub ? (
          <Card>
            <Row label={t('tabs.billing.currentPlan')}>
              <Badge label={t(`tabs.billing.status.${sub.status}`)} status={STATUS_TONE[sub.status] ?? 'neutral'} />
            </Row>
            {seatLimit != null ? (
              <Txt variant="caption" tone="textMuted">
                {t('tabs.billing.seatsUsed', { used: seatCount, limit: seatLimit })}
              </Txt>
            ) : null}
          </Card>
        ) : null}

        <PaywallBody sub={sub} seatCount={seatCount} isAdmin={role === 'admin'} trialDaysLeft={trialDaysLeft} />
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
});
