import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Money, Txt, borders, radii, spacing, useTheme } from '@chrono/ui';
import { projectStatusLabel } from '@chrono/sdk';
import type { Project } from '@chrono/sdk';
import { projectBadge } from '@/lib/status';

export interface ProjectCardProps {
  project: Project;
  currency: string;
  onPress?: () => void;
}

/** Summary card for a project row: name, client, TJM and status. */
export function ProjectCard({ project, currency, onPress }: ProjectCardProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={onPress == null}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed && onPress ? colors.surfaceRaised : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconTile, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}>
          <Ionicons name="folder-outline" size={18} color={colors.accent} />
        </View>
        <View style={styles.titleWrap}>
          <Txt variant="bodyMedium" numberOfLines={1}>
            {project.name}
          </Txt>
          {project.client_name ? (
            <Txt variant="caption" tone="textMuted" numberOfLines={1}>
              {project.client_name}
            </Txt>
          ) : null}
        </View>
        <Badge label={projectStatusLabel(project.status)} status={projectBadge(project.status)} />
      </View>
      {project.default_tjm_cents != null ? (
        <View style={styles.meta}>
          <Txt variant="caption" tone="textMuted">
            TJM
          </Txt>
          <Money cents={project.default_tjm_cents} currency={currency} variant="caption" tone="textMuted" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: borders.thin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
