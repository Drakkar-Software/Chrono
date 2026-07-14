import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, Card, Txt, spacing, useTheme } from '@chrono/ui';

export interface AuthCardProps {
  title: string;
  subtitle?: string;
  /** Form fields / body content. */
  children: ReactNode;
  /** Secondary links rendered under the card body. */
  footer?: ReactNode;
}

/**
 * Centered, keyboard-aware auth scaffold: the Chrono brand mark over a single
 * capped Card, vertically + horizontally centered on every screen size. Shared
 * by login / register / reset-password / onboarding. Matches the landing look.
 */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.centered}>
          <BrandMark size={68} />

          <Card padding="xl" shadow="md" style={styles.card}>
            <View style={styles.heading}>
              <Txt variant="title" center>
                {title}
              </Txt>
              {subtitle ? (
                <Txt variant="body" tone="textMuted" center>
                  {subtitle}
                </Txt>
              ) : null}
            </View>
            {children}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  centered: { width: '100%', maxWidth: 420, alignItems: 'center', gap: spacing.lg },
  card: { width: '100%', gap: spacing.md },
  heading: { gap: spacing.xs, marginBottom: spacing.xs },
  footer: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
});
