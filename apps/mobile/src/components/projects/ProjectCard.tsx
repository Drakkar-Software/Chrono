import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, IconBadge, Money, Txt, borders, radii, spacing, useTheme } from '@chrono/ui';
import type { Project } from '@chrono/sdk';
import { projectBadge } from '@/lib/status';
import { useT } from '@/lib/i18n';

export interface ProjectCardProps {
  project: Project;
  currency: string;
  onPress?: () => void;
}

/** Summary card for a project row: name, client, TJM and status. */
export function ProjectCard({ project, currency, onPress }: ProjectCardProps) {
  const t = useT();
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
        <IconBadge name="folder-outline" shape="rounded" />
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
        <Badge label={t('status.' + project.status)} status={projectBadge(project.status)} />
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
  titleWrap: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
