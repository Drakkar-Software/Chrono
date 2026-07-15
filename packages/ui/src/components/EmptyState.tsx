import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { borders, radii, spacing } from '../theme';
import { useTheme, type Palette } from '../use-theme';
import { Txt } from './Txt';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type EmptyStateTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface EmptyStateProps {
  /** Ionicons glyph shown in the dial above the title. */
  icon?: IoniconName;
  title: string;
  subtitle?: string;
  /** Optional action node (e.g. a `<Button/>`) rendered below the copy. */
  action?: ReactNode;
  /** Semantic tint for the dial: invites action, confirms completion, or flags a problem. Default 'neutral'. */
  tone?: EmptyStateTone;
}

const TONE_TOKENS: Record<EmptyStateTone, { fg: keyof Palette; ring: keyof Palette; fill: keyof Palette }> = {
  neutral: { fg: 'textFaint', ring: 'border', fill: 'fill' },
  accent: { fg: 'accent', ring: 'accentBorder', fill: 'accentBg' },
  success: { fg: 'success', ring: 'success', fill: 'successBg' },
  warning: { fg: 'warning', ring: 'warning', fill: 'warningBg' },
  danger: { fg: 'danger', ring: 'danger', fill: 'dangerBg' },
};

const DIAL_SIZE = 88;
const CROWN_SIZE = { width: 10, height: 7 };

/**
 * Centered dial + title + subtitle for empty lists / zero-data / dead-end
 * states. The icon sits inside a stopwatch-style dial (a ring with a crown
 * notch, echoing `BrandMark`) so even "nothing here" still reads as Chrono.
 */
export function EmptyState({ icon, title, subtitle, action, tone = 'neutral' }: EmptyStateProps) {
  const { colors } = useTheme();
  const toneTokens = TONE_TOKENS[tone];
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [progress]);

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={{
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        }}
      >
        {icon ? (
          <View style={styles.dialWrap}>
            <View style={[styles.crown, { backgroundColor: colors[toneTokens.ring] }]} />
            <View
              style={[styles.dial, { borderColor: colors[toneTokens.ring], backgroundColor: colors[toneTokens.fill] }]}
            >
              <Ionicons name={icon} size={32} color={colors[toneTokens.fg]} />
            </View>
          </View>
        ) : null}
        <Txt variant="title" center style={styles.title}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="body" tone="textMuted" center style={styles.subtitle}>
            {subtitle}
          </Txt>
        ) : null}
        {action ? <View style={styles.action}>{action}</View> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    minHeight: 240,
  },
  dialWrap: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  crown: {
    position: 'absolute',
    top: -(CROWN_SIZE.height - 1),
    left: '50%',
    marginLeft: -(CROWN_SIZE.width / 2),
    width: CROWN_SIZE.width,
    height: CROWN_SIZE.height,
    borderRadius: radii.sm / 2,
  },
  dial: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: radii.pill,
    borderWidth: borders.thick,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { maxWidth: 280 },
  subtitle: { marginTop: spacing.xs, maxWidth: 280 },
  action: { marginTop: spacing.xl },
});
