import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt, spacing } from '@chrono/ui';

export interface SectionHeaderProps {
  /** Section title (heading). */
  title: string;
  /** Small mono uppercase eyebrow above the title (landing-style). */
  eyebrow?: string;
  /** Count shown as a muted suffix after the title. */
  count?: number;
  /** Right-aligned action (e.g. a `<Button/>`). */
  action?: ReactNode;
}

/** Consistent section heading: optional eyebrow, title (+count), right action. */
export function SectionHeader({ title, eyebrow, count, action }: SectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.titles}>
        {eyebrow ? (
          <Txt variant="micro" mono uppercase tone="accent" style={styles.eyebrow}>
            {eyebrow}
          </Txt>
        ) : null}
        <View style={styles.titleRow}>
          <Txt variant="heading">{title}</Txt>
          {count != null ? (
            <Txt variant="heading" tone="textFaint">
              {count}
            </Txt>
          ) : null}
        </View>
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 32,
  },
  titles: { flex: 1, gap: 2 },
  eyebrow: { letterSpacing: 1.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  action: { flexShrink: 0 },
});
