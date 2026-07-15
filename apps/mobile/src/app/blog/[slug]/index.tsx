import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { BrandMark, Button, Txt, spacing, useTheme } from '@chrono/ui';
import {
  fetchBlogArticles,
  getBlogArticleTranslation,
  blogArticleDescription,
} from '@chrono/sdk';

import { useT, useLanguage } from '@/lib/i18n';
import { globalSupabaseClient } from '@/lib/supabase';
import { useBlogArticleBySlug } from '@/lib/hooks/use-blog';
import { absoluteUrl } from '@/lib/site';
import { ArticleBody } from '@/components/blog/ArticleBody';
import { Seo } from '@/components/blog/Seo';

/**
 * Best-effort static prerendering: emit an HTML file per published article at
 * export time so each URL has its own document + canonical. Falls back to an
 * empty list (client-rendered via SPA fallback) if the build has no DB access.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const articles = await fetchBlogArticles(globalSupabaseClient);
    return articles.map((a) => ({ slug: a.slug }));
  } catch {
    return [];
  }
}

export default function BlogArticlePage() {
  const t = useT();
  const { locale } = useLanguage();
  const { colors } = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: article, isLoading } = useBlogArticleBySlug(slug);

  const formatDate = useCallback(
    (iso: string | null) =>
      new Date(iso || 0).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }),
    [locale],
  );

  const Chrome = ({ children }: { children: React.ReactNode }) => (
    <ScrollView style={{ backgroundColor: colors.canvas }} contentContainerStyle={styles.scroll}>
      <View style={styles.inner}>
        <Link href="/blog" asChild>
          <View accessibilityRole="link" style={styles.brand}>
            <BrandMark size={28} shadow={false} />
            <Txt variant="bodyMedium" tone="textMuted">{t('blog.back')}</Txt>
          </View>
        </Link>
        {children}
      </View>
    </ScrollView>
  );

  if (isLoading && !article) {
    return (
      <Chrome>
        <Seo title={`${t('blog.metaTitle')}`} />
        <Txt variant="body" tone="textMuted" style={styles.pad}>{t('blog.loading')}</Txt>
      </Chrome>
    );
  }

  if (!article) {
    return (
      <Chrome>
        <Seo title={`${t('blog.notFoundTitle')} — Chrono`} description={t('blog.notFoundBody')} />
        <View style={styles.pad}>
          <Txt variant="title" weight="bold">{t('blog.notFoundTitle')}</Txt>
          <Txt variant="body" tone="textMuted" style={styles.gap}>{t('blog.notFoundBody')}</Txt>
          <Link href="/blog" asChild>
            <Button title={t('blog.back')} variant="secondary" />
          </Link>
        </View>
      </Chrome>
    );
  }

  const tr = getBlogArticleTranslation(article.content, locale);
  const description = blogArticleDescription(article.content, locale);
  const url = absoluteUrl(`/blog/${article.slug}`);
  const readLabel = article.read_time ? t('blog.readTime', { n: article.read_time }) : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: tr.title,
    description,
    url,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    inLanguage: locale,
    author: { '@type': 'Organization', name: article.author || 'Chrono' },
    publisher: { '@type': 'Organization', name: 'Chrono' },
    ...(article.image_url ? { image: article.image_url } : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  return (
    <Chrome>
      <Seo
        title={`${tr.title} — Chrono`}
        description={description}
        url={url}
        image={article.image_url ?? undefined}
        type="article"
        publishedTime={article.published_at ?? undefined}
        jsonLd={jsonLd}
      />
      <View style={styles.article}>
        <Txt variant="label" tone="accent">{t('blog.eyebrow')}</Txt>
        <Txt variant="displayLg" weight="bold" style={styles.title}>{tr.title}</Txt>
        <View style={styles.meta}>
          <Txt variant="caption" tone="textMuted">{t('blog.by')} {article.author || 'Chrono'}</Txt>
          <Txt variant="caption" tone="textMuted">·</Txt>
          <Txt variant="caption" tone="textMuted">{formatDate(article.published_at)}</Txt>
          {readLabel ? (
            <>
              <Txt variant="caption" tone="textMuted">·</Txt>
              <Txt variant="caption" tone="textMuted">{readLabel}</Txt>
            </>
          ) : null}
        </View>

        {article.image_url ? (
          <View style={[styles.hero, { borderColor: colors.border }]}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <img src={article.image_url} alt="" style={styles.heroImg as any} />
          </View>
        ) : null}

        <View style={styles.body}>
          <ArticleBody markdown={tr.content} />
        </View>

        <View style={[styles.cta, { borderTopColor: colors.border }]}>
          <Link href="/" asChild>
            <Button title={t('blog.cta')} variant="primary" />
          </Link>
          <Link href="/blog" asChild>
            <Button title={t('blog.back')} variant="ghost" />
          </Link>
        </View>
      </View>
    </Chrome>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  inner: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pad: { paddingVertical: spacing.xl, gap: spacing.sm },
  gap: { marginBottom: spacing.md },
  article: { gap: spacing.sm },
  title: { marginTop: spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  hero: { width: '100%', aspectRatio: 16 / 9, borderRadius: 18, overflow: 'hidden', borderWidth: 1, marginTop: spacing.lg },
  heroImg: { width: '100%', height: '100%', objectFit: 'cover' },
  body: { marginTop: spacing.lg },
  cta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1 },
});
