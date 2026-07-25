import { useEffect, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button,
  Card,
  EmptyState,
  Row,
  StackScreen,
  Txt,
  borders,
  radii,
  spacing,
  useTheme,
} from '@chrono/ui';
import { formatDuration } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useAppAuth } from '@/lib/supabase-stores';
import { useTimeOff, useTimeOffMutations } from '@/lib/hooks/use-time-off';
import { ScreenLoader } from '@/components/common/ScreenLoader';
import { ErrorState, InlineError } from '@/components/common/ErrorState';
import { HeaderOverflowMenu } from '@/components/common/HeaderOverflowMenu';

export default function TimeOffDetail() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAppAuth();

  const { data: timeOff, isLoading, error, refetch } = useTimeOff(id);
  const { remove, isPending, error: mutError } = useTimeOffMutations();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (!cancelled) setReduceMotion(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isOwner = !!user?.id && !!timeOff && user.id === timeOff.user_id;

  const headerRight = isOwner ? (
    <HeaderOverflowMenu
      accessibilityLabel={t('common.more')}
      items={[
        {
          label: t('details.timeOffCancel'),
          destructive: true,
          onPress: () => setShowCancelConfirm(true),
        },
      ]}
    />
  ) : undefined;

  if (isLoading && !timeOff) {
    return (
      <StackScreen title={t('details.timeOff')} onBack={() => router.back()} headerRight={headerRight}>
        <ScreenLoader />
      </StackScreen>
    );
  }
  if (error && !timeOff) {
    return (
      <StackScreen title={t('details.timeOff')} onBack={() => router.back()} headerRight={headerRight}>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </StackScreen>
    );
  }
  if (!timeOff) {
    return (
      <StackScreen title={t('details.timeOff')} onBack={() => router.back()} headerRight={headerRight}>
        <EmptyState
          icon="calendar-outline"
          title={t('details.timeOffNotFound')}
          subtitle={t('details.mayHaveBeenRemoved')}
        />
      </StackScreen>
    );
  }

  const kindLabel = t(`comp.timeOff.kind.${timeOff.kind}`);
  const dateLabel = timeOff.off_date.slice(0, 10);
  const durationLabel =
    timeOff.duration_minutes != null
      ? formatDuration(timeOff.duration_minutes)
      : t('comp.timeOff.fullDay');

  const onConfirmCancel = async () => {
    await remove(timeOff.id);
    setShowCancelConfirm(false);
    router.back();
  };

  return (
    <StackScreen title={t('details.timeOff')} onBack={() => router.back()} headerRight={headerRight}>
      <View style={styles.wrap}>
        <Card padding="lg" style={styles.summary}>
          <Txt variant="heading" numberOfLines={2}>
            {kindLabel}
          </Txt>
          <Row label={t('common.date')}>
            <Txt variant="bodyMedium" mono>
              {dateLabel}
            </Txt>
          </Row>
          <Row label={t('comp.timeOff.amount')}>
            <Txt variant="bodyMedium" mono tabularNums>
              {durationLabel}
            </Txt>
          </Row>
          {timeOff.note ? (
            <Row label={t('comp.time.description')}>
              <Txt variant="body" tone="textMuted" style={styles.note}>
                {timeOff.note}
              </Txt>
            </Row>
          ) : null}
        </Card>

        {mutError ? <InlineError error={mutError} /> : null}
      </View>

      <Modal
        visible={showCancelConfirm}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setShowCancelConfirm(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setShowCancelConfirm(false)}
        >
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Txt variant="heading">{t('details.timeOffCancelTitle')}</Txt>
            <Txt variant="body" tone="textMuted">
              {t('details.timeOffCancelBody', { kind: kindLabel, date: dateLabel })}
            </Txt>
            <View style={styles.actions}>
              <Button
                title={t('common.cancel')}
                variant="secondary"
                fullWidth
                onPress={() => setShowCancelConfirm(false)}
              />
              <Button
                title={t('details.timeOffCancelConfirm')}
                variant="danger"
                fullWidth
                loading={isPending}
                onPress={() => void onConfirmCancel()}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  summary: { gap: spacing.sm },
  note: { flex: 1, textAlign: 'right' },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  sheet: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: borders.thin,
  },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
