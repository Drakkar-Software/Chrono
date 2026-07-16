import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/**
 * A single Animated.Value that eases to `fraction` on mount/change (the
 * "needle settle" motion — see `@chrono/ui`'s `motion` tokens), snapping
 * instead when the user has reduce-motion on. Shared by every Chrono Pro
 * instrument (`SeatCapacityTrack`, `TrialCountdown`) so the two never drift.
 *
 * Uses lazy `useState` rather than `useRef` for the Animated.Value: this repo's
 * `eslint-config-expo` pulls in `eslint-plugin-react-hooks`'s refs check, which
 * flags `.interpolate()` called on a `useRef(...).current` value during render
 * (confirmed via `pnpm lint`, not merely inferred from config) — `useState`'s
 * lazy initializer gives the same one-time-instance guarantee without it.
 */
export function useSettleProgress(fraction: number): Animated.Value {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        progress.setValue(fraction);
        return;
      }
      Animated.timing(progress, {
        toValue: fraction,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- progress is a stable Animated.Value instance
  }, [fraction]);

  return progress;
}
