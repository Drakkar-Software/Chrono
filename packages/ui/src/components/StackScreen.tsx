import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { borders, layout, spacing } from '../theme';
import { useTheme } from '../use-theme';
import { useResponsive } from '../provider';
import { IconButton } from './IconButton';
import { Txt } from './Txt';

export interface StackScreenProps {
  /** Header title. Omit for a header-less screen. */
  title?: string;
  /** Show a back chevron on the left; called on press. */
  onBack?: () => void;
  /** Optional right-aligned action rendered in the header. */
  headerRight?: ReactNode;
  /** Pinned footer (a CTA button or composer). */
  footer?: ReactNode;
  children: ReactNode;
  /** Scroll the content area. Default true. */
  scroll?: boolean;
  /** Background: `canvas` (default) or `surface`. */
  background?: 'canvas' | 'surface';
  /** Use the wider dashboard cap (`layout.maxContentWidthWide`) instead of the reading-width cap. For card-grid screens on large viewports. Default false. */
  wide?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

// On web the stock KeyboardAvoidingView is a passthrough; keep it a plain View.
const KAV = Platform.OS === 'web' ? View : KeyboardAvoidingView;

/**
 * Header (title + optional back + optional right action) over a scrollable,
 * width-capped, keyboard-avoiding content area, with an optional pinned footer.
 * Presentational scaffold — route pages pass a title and callbacks only.
 */
export function StackScreen({
  title,
  onBack,
  headerRight,
  footer,
  children,
  scroll = true,
  background = 'canvas',
  wide = false,
  contentStyle,
}: StackScreenProps) {
  const { colors } = useTheme();
  const { isWide } = useResponsive();
  const insets = useSafeAreaInsets();
  const bg = background === 'surface' ? colors.surface : colors.canvas;
  const hasHeader = title != null || onBack != null || headerRight != null;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {hasHeader ? (
        <View style={{ paddingTop: insets.top, backgroundColor: colors.surface }}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerSide}>
              {onBack ? <IconButton name="chevron-back" onPress={onBack} accessibilityLabel="Back" /> : null}
            </View>
            <View style={styles.headerTitle}>
              {title ? (
                <Txt variant="heading" numberOfLines={1}>
                  {title}
                </Txt>
              ) : null}
            </View>
            <View style={[styles.headerSide, styles.headerRight]}>{headerRight}</View>
          </View>
        </View>
      ) : null}

      <KAV style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={[
            styles.center,
            isWide && { maxWidth: wide ? layout.maxContentWidthWide : layout.maxContentWidth, alignSelf: 'center' },
          ]}
        >
          {body}
        </View>

        {footer ? (
          <SafeAreaView edges={['left', 'right', 'bottom']} style={{ backgroundColor: colors.surface }}>
            <View style={styles.footer}>{footer}</View>
          </SafeAreaView>
        ) : null}
      </KAV>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    minHeight: layout.headerMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: borders.hairline,
  },
  headerSide: { minWidth: 44, justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { flex: 1, alignItems: 'center' },
  center: { flex: 1, width: '100%' },
  scrollContent: { flexGrow: 1, padding: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
});
