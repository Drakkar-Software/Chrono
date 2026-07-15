import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { BrandMark, Button, Txt, spacing, useResponsive, useTheme } from '@chrono/ui';
import type { BlogArticle } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { useLanguage } from '@/lib/i18n';
import { useBlogArticles } from '@/lib/hooks/use-blog';
import { absoluteUrl } from '@/lib/site';
import { ArticleCard } from '@/components/blog/ArticleCard';
import { Seo } from '@/components/blog/Seo';

export default function BlogIndex() {
  const t = useT();
  const { locale } = useLanguage();
  const { colors } = useTheme();
  const { isWide } = useResponsive();
  const { data: articles, isLoading } = useBlogArticles();

  const formatDate = useCallback(
    (iso: string | null) =>
      new Date(iso || 0).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }),
    [locale],
  );

  const list = articles ?? [];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Chrono',
    url: absoluteUrl('/blog'),
    description: t('blog.metaDescription'),
    blogPost: list.map((a: BlogArticle) => ({
      '@type': 'BlogPosting',
      headline:
        (a.content?.title_translations?.[locale] as string) ||
        (a.content?.title_translations?.en as string) ||
        a.slug,
      url: absoluteUrl(`/blog/${a.slug}`),
      datePublished: a.published_at,
    })),
  };

  return (
    <ScrollView style={{ backgroundColor: colors.canvas }} contentContainerStyle={styles.scroll}>
      <Seo
        title={t('blog.metaTitle')}
        description={t('blog.metaDescription')}
        url={absoluteUrl('/blog')}
        jsonLd={jsonLd}
      />
      <View style={styles.inner}>
        <Link href="/" asChild>
          <View accessibilityRole="link" style={styles.brand}>
            <BrandMark size={30} shadow={false} />
            <Txt variant="heading" weight="bold">Chrono</Txt>
          </View>
        </Link>

        <View style={styles.hero}>
          <Txt variant="label" tone="accent">{t('blog.eyebrow')}</Txt>
          <Txt variant="display" weight="bold" style={styles.title}>{t('blog.title')}</Txt>
          <Txt variant="body" tone="textMuted" style={styles.lede}>{t('blog.lede')}</Txt>
        </View>

        {isLoading && list.length === 0 ? (
          <Txt variant="body" tone="textMuted">{t('blog.loading')}</Txt>
        ) : list.length === 0 ? (
          <Txt variant="body" tone="textMuted">{t('blog.empty')}</Txt>
        ) : (
          <View style={[styles.grid, isWide && styles.gridWide]}>
            {list.map((a) => (
              <View key={a.id} style={isWide ? styles.colWide : styles.col}>
                <ArticleCard article={a} locale={locale} formatDate={formatDate} />
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <Link href="/" asChild>
            <Button title={t('blog.backHome')} variant="secondary" />
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  inner: { width: '100%', maxWidth: 960, alignSelf: 'center', gap: spacing.xl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hero: { gap: spacing.sm, maxWidth: 720 },
  title: { marginTop: spacing.xs },
  lede: { maxWidth: 640 },
  grid: { gap: spacing.lg },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  col: { width: '100%' },
  colWide: { width: '48%', minWidth: 300, flexGrow: 1 },
  footer: { alignItems: 'flex-start', paddingTop: spacing.md },
});
