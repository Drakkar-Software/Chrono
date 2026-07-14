import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { type Edge, useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '../theme';
import { useTheme } from '../use-theme';

export interface ScreenProps {
  children: ReactNode;
  /**
   * Safe-area edges to inset. Default `['left', 'right', 'top']` — bottom is
   * intentionally excluded so a tab bar / footer owns that inset (see the
   * NativeTabs bottom-inset rule).
   */
  edges?: Edge[];
  /** Center + cap content width on wide/web viewports. Default true. */
  center?: boolean;
  /** Style applied to the inner content container. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Generic screen scaffold: themed `canvas` background + safe-area insets, with
 * optional max-width centering so the app reads well on web. Presentational —
 * no navigation, no data.
 */
export function Screen({ children, edges = ['left', 'right', 'top'], center = true, style }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const safeArea = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };
  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <View style={[styles.safe, safeArea]}>
        <View style={[styles.content, center && styles.centered, style]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center' },
  content: { flex: 1, width: '100%' },
  centered: { maxWidth: layout.maxContentWidth, alignSelf: 'center' },
});
