import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Txt, borders, radii, spacing, useTheme } from '@chrono/ui';
import { PRODUCT_PLAN_MAP } from '@chrono/sdk';
import type { CompanySubscription } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { CHRONO_PRO_PRODUCT_IDS, type ChronoProProductId, type Tier } from '@/lib/revenuecat-constants';
import { getTierPackages, purchaseTier, restorePurchases } from '@/lib/revenuecat';
import { SeatCapacityTrack } from './SeatCapacityTrack';
import { TrialCountdown } from './TrialCountdown';

const TIER_LABEL_KEYS: Record<ChronoProProductId, string> = {
  chrono_pro_solo: 'tabs.billing.tierSolo',
  chrono_pro_team: 'tabs.billing.tierTeam',
  chrono_pro_scale: 'tabs.billing.tierScale',
};

export interface PaywallBodyProps {
  sub: CompanySubscription | null | undefined;
  seatCount: number;
  /** Only admins can purchase or restore — everyone else gets a read-only view. */
  isAdmin: boolean;
  trialDaysLeft: number | null;
  /** Called after a successful purchase or restore, so the caller can dismiss the sheet/screen. */
  onDone?: () => void;
}

function formatEndDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function PaywallBody({ sub, seatCount, isAdmin, trialDaysLeft, onDone }: PaywallBodyProps) {
  const { colors } = useTheme();
  const t = useT();
  const [tiers, setTiers] = useState<Tier[] | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTierPackages()
      .then((t) => {
        if (active) setTiers(t);
      })
      .catch(() => {
        if (active) setTiers([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // The smallest tier that still covers the current seat count — "the plan that fits".
  const fittingProductId = [...CHRONO_PRO_PRODUCT_IDS].find(
    (id) => seatCount <= (PRODUCT_PLAN_MAP[id]?.seatLimit ?? Infinity),
  );

  const onPurchase = async (tier: Tier) => {
    setMessage(null);
    setPurchasingId(tier.productId);
    const outcome = await purchaseTier(tier);
    setPurchasingId(null);
    if (outcome.kind === 'purchased') {
      onDone?.();
    } else if (outcome.kind === 'failed') {
      setMessage(t('tabs.billing.purchaseFailed'));
    }
  };

  const onRestore = async () => {
    setMessage(null);
    setRestoring(true);
    const ok = await restorePurchases();
    setRestoring(false);
    if (ok) onDone?.();
    else setMessage(t('tabs.billing.nothingToRestore'));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Txt variant="title">{t('tabs.billing.title')}</Txt>
        <Txt variant="body" tone="textMuted">
          {t('tabs.billing.subtitle')}
        </Txt>
      </View>

      {sub?.status === 'trialing' && trialDaysLeft != null ? (
        <TrialCountdown daysLeft={trialDaysLeft} endsOnLabel={formatEndDate(sub.trial_ends_at)} />
      ) : null}

      <SeatCapacityTrack
        tiers={CHRONO_PRO_PRODUCT_IDS.map((id) => ({
          seatLimit: PRODUCT_PLAN_MAP[id].seatLimit,
          label: t(TIER_LABEL_KEYS[id]),
        }))}
        seatCount={seatCount}
      />

      <View style={styles.tierRow}>
        {CHRONO_PRO_PRODUCT_IDS.map((productId) => {
          const tier = tiers?.find((candidate) => candidate.productId === productId);
          const fits = productId === fittingProductId;
          const label = t(TIER_LABEL_KEYS[productId]);
          return (
            <Card
              key={productId}
              padding="md"
              style={[styles.tierCard, fits ? { borderColor: colors.accent, backgroundColor: colors.accentBg } : null]}
            >
              <Txt variant="label" uppercase tone={fits ? 'accent' : 'textMuted'}>
                {label}
              </Txt>
              <Txt variant="caption" tone="textFaint" mono tabularNums>
                {t('tabs.billing.upTo', { n: PRODUCT_PLAN_MAP[productId].seatLimit })}
              </Txt>
              <Txt variant="heading" mono tabularNums weight="bold" style={styles.tierPrice}>
                {tier ? tier.priceString : tiers == null ? '···' : '—'}
              </Txt>
              {isAdmin ? (
                <Button
                  title={fits ? t('tabs.billing.startTier', { tier: label }) : t('tabs.billing.chooseTier')}
                  size="sm"
                  variant={fits ? 'primary' : 'secondary'}
                  disabled={!tier}
                  loading={purchasingId === productId}
                  onPress={() => tier && onPurchase(tier)}
                  fullWidth
                />
              ) : null}
            </Card>
          );
        })}
      </View>

      {message ? (
        <Txt variant="caption" tone="danger" center>
          {message}
        </Txt>
      ) : null}

      {isAdmin ? (
        <Button
          title={t('tabs.billing.restorePurchase')}
          variant="ghost"
          size="sm"
          loading={restoring}
          onPress={onRestore}
          center
        />
      ) : (
        <Txt variant="caption" tone="textMuted" center>
          {t('tabs.billing.askAdmin')}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  header: { gap: spacing.xs },
  tierRow: { flexDirection: 'row', gap: spacing.sm },
  tierCard: { flex: 1, borderRadius: radii.md, borderWidth: borders.thin, gap: spacing.xs, alignItems: 'flex-start' },
  tierPrice: { marginTop: spacing.xs, marginBottom: spacing.xs },
});
