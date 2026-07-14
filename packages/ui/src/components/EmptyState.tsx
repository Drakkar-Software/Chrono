import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme';
import { useTheme } from '../use-theme';
import { Txt } from './Txt';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface EmptyStateProps {
  /** Ionicons glyph shown above the title. */
  icon?: IoniconName;
  title: string;
  subtitle?: string;
  /** Optional action node (e.g. a `<Button/>`) rendered below the copy. */
  action?: ReactNode;
}

/** Centered icon + title + subtitle for empty lists / zero-data states. */
export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {icon ? <Ionicons name={icon} size={40} color={colors.textFaint} style={styles.icon} /> : null}
      <Txt variant="heading" center>
        {title}
      </Txt>
      {subtitle ? (
        <Txt variant="body" tone="textMuted" center style={styles.subtitle}>
          {subtitle}
        </Txt>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
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
  icon: { marginBottom: spacing.md },
  subtitle: { marginTop: spacing.xs, maxWidth: 320 },
  action: { marginTop: spacing.lg },
});
