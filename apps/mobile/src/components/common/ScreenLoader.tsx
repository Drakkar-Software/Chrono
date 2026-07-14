import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Txt, spacing, useTheme } from '@chrono/ui';

export interface ScreenLoaderProps {
  /** Optional caption under the spinner. */
  message?: string;
  /** Fill and center in the available space. Default true. */
  fill?: boolean;
}

/**
 * Centered spinner block for pending states. Drop inside any `StackScreen` /
 * `Screen` content so the loading state keeps the surrounding layout (header,
 * safe area) instead of a bare spinner.
 */
export function ScreenLoader({ message, fill = true }: ScreenLoaderProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, fill && styles.fill]}>
      <ActivityIndicator size="large" color={colors.accent} />
      {message ? (
        <Txt variant="caption" tone="textMuted" center style={styles.message}>
          {message}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  fill: { flex: 1, minHeight: 240 },
  message: { marginTop: spacing.md },
});
