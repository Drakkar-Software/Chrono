import { Pressable, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { Txt, borders, radii, spacing, useTheme } from '@chrono/ui';
import { getBlogArticleTranslation } from '@chrono/sdk';
import type { BlogArticle } from '@chrono/sdk';
import { useT } from '@/lib/i18n';

export interface ArticleCardProps {
  article: BlogArticle;
  locale: string;
  formatDate: (iso: string | null) => string;
}

/** A blog index card: optional cover, title, excerpt, date + read time. */
export function ArticleCard({ article, locale, formatDate }: ArticleCardProps) {
  const t = useT();
  const { colors } = useTheme();
  const tr = getBlogArticleTranslation(article.content, locale);
  const readLabel = article.read_time ? t('blog.readTime', { n: article.read_time }) : null;

  return (
    <Link href={`/blog/${article.slug}`} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={tr.title}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: pressed ? colors.surfaceRaised : colors.surface, borderColor: colors.border },
        ]}
      >
        {article.image_url ? (
          <View style={[styles.cover, { backgroundColor: colors.fill }]}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <img src={article.image_url} alt="" style={styles.coverImg as any} />
          </View>
        ) : null}
        <View style={styles.body}>
          <Txt variant="heading" weight="bold" numberOfLines={2}>
            {tr.title}
          </Txt>
          {tr.excerpt ? (
            <Txt variant="body" tone="textMuted" numberOfLines={3}>
              {tr.excerpt}
            </Txt>
          ) : null}
          <View style={styles.meta}>
            <Txt variant="caption" tone="textMuted">
              {formatDate(article.published_at)}
            </Txt>
            {readLabel ? (
              <>
                <Txt variant="caption" tone="textMuted">·</Txt>
                <Txt variant="caption" tone="textMuted">{readLabel}</Txt>
              </>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: borders.thin,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  cover: { width: '100%', aspectRatio: 16 / 9 },
  coverImg: { width: '100%', height: '100%', objectFit: 'cover' },
  body: { gap: spacing.sm, padding: spacing.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
});
