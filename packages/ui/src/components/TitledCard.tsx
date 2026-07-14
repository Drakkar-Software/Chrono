import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme';
import { Card } from './Card';
import { Txt } from './Txt';

export interface TitledCardProps {
  /** Card heading. */
  title: string;
  /** Optional muted line under the title. */
  subtitle?: string;
  /** Right-aligned header action (e.g. a `<Button/>`). */
  action?: ReactNode;
  /** Truncate the title to N lines (e.g. 1 for long names). Default: no clamp. */
  titleNumberOfLines?: number;
  /** Inner padding from the spacing scale. Default `lg`. */
  padding?: keyof typeof spacing;
  /** Vertical gap between children. Default `md`. */
  gap?: keyof typeof spacing;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * A themed `Card` opening with a heading (+ optional subtitle / right action)
 * over gap-separated content. The shared scaffold for every titled panel —
 * settings sections, display cards and forms alike — so the Card + heading +
 * `gap` triple isn't re-implemented per screen.
 */
export function TitledCard({
  title,
  subtitle,
  action,
  titleNumberOfLines,
  padding = 'lg',
  gap = 'md',
  children,
  style,
}: TitledCardProps) {
  return (
    <Card padding={padding} style={[{ gap: spacing[gap] }, style]}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <Txt variant="heading" numberOfLines={titleNumberOfLines}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="caption" tone="textMuted">
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titles: { flex: 1, gap: 2 },
  action: { flexShrink: 0 },
});
