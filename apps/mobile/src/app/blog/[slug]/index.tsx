import { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { Button, Txt, spacing, useTheme } from "@chrono/ui";
import {
  fetchBlogArticles,
  getBlogArticleTranslation,
  blogArticleDescription,
} from "@chrono/sdk";

import { useT, useLanguage } from "@/lib/i18n";
import { globalSupabaseClient } from "@/lib/supabase";
import { useBlogArticleBySlug } from "@/lib/hooks/use-blog";
import { absoluteUrl } from "@/lib/site";
import { ArticleBody } from "@/components/blog/ArticleBody";
import { Seo } from "@/components/blog/Seo";
import {
  MarketingFonts,
  marketingDisplayFont,
} from "@/components/marketing/MarketingFonts";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { StatementBand } from "@/components/marketing/StatementBand";

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

/** Shared page chrome: fonts, nav, centered reading column + optional full-bleed footer. */
function ArticleChrome({
  canvasColor,
  footer,
  children,
}: {
  canvasColor: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ScrollView style={{ backgroundColor: canvasColor }} contentContainerStyle={styles.scroll}>
      <MarketingFonts />
      <MarketingNav />
      <View style={styles.inner}>{children}</View>
      {footer}
    </ScrollView>
  );
}

export default function BlogArticlePage() {
  const t = useT();
  const { locale } = useLanguage();
  const { colors } = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: article, isLoading } = useBlogArticleBySlug(slug);

  const formatDate = useCallback(
    (iso: string | null) =>
      new Date(iso || 0).toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [locale],
  );

  if (isLoading && !article) {
    return (
      <ArticleChrome canvasColor={colors.canvas}>
        <Seo title={`${t("blog.metaTitle")}`} />
        <Txt variant="body" tone="textMuted" style={styles.pad}>
          {t("blog.loading")}
        </Txt>
      </ArticleChrome>
    );
  }

  if (!article) {
    return (
      <ArticleChrome canvasColor={colors.canvas}>
        <Seo
          title={`${t("blog.notFoundTitle")} — Chrono`}
          description={t("blog.notFoundBody")}
        />
        <View style={styles.pad}>
          <Txt variant="title" weight="bold">
            {t("blog.notFoundTitle")}
          </Txt>
          <Txt variant="body" tone="textMuted" style={styles.gap}>
            {t("blog.notFoundBody")}
          </Txt>
          <Link href="/blog" asChild>
            <Button title={t("blog.back")} variant="secondary" />
          </Link>
        </View>
      </ArticleChrome>
    );
  }

  const tr = getBlogArticleTranslation(article.content, locale);
  const description = blogArticleDescription(article.content, locale);
  const url = absoluteUrl(`/blog/${article.slug}`);
  const readLabel = article.read_time
    ? t("blog.readTime", { n: article.read_time })
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: tr.title,
    description,
    url,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    inLanguage: locale,
    author: { "@type": "Organization", name: article.author || "Chrono" },
    publisher: { "@type": "Organization", name: "Chrono" },
    ...(article.image_url ? { image: article.image_url } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  return (
    <ArticleChrome
      canvasColor={colors.canvas}
      footer={
        <StatementBand
          title={t("blog.cta")}
          ctaLabel={t("auth.createAccount")}
        />
      }
    >
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
        <Link href="/blog" asChild>
          <Txt
            variant="bodyMedium"
            weight="semibold"
            tone="accent"
            accessibilityRole="link"
            style={styles.backLink}
          >
            {`←  ${t("blog.back")}`}
          </Txt>
        </Link>

        <Txt
          variant="caption"
          mono
          uppercase
          tone="accent"
          style={styles.eyebrow}
        >
          {t("blog.eyebrow")}
        </Txt>
        <Txt
          variant="displayLg"
          weight="bold"
          style={[
            styles.title,
            { fontFamily: marketingDisplayFont, letterSpacing: -0.5 },
          ]}
        >
          {tr.title}
        </Txt>
        <View style={[styles.meta, { borderTopColor: colors.border }]}>
          <Txt variant="caption" mono tone="textMuted">
            {t("blog.by")} {article.author || "Chrono"}
          </Txt>
          <Txt variant="caption" tone="textMuted">
            ·
          </Txt>
          <Txt variant="caption" mono tone="textMuted">
            {formatDate(article.published_at)}
          </Txt>
          {readLabel ? (
            <>
              <Txt variant="caption" tone="textMuted">
                ·
              </Txt>
              <Txt variant="caption" mono tone="textMuted">
                {readLabel}
              </Txt>
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
      </View>
    </ArticleChrome>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  inner: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  pad: { paddingVertical: spacing.xl, gap: spacing.sm },
  gap: { marginBottom: spacing.md },
  article: { gap: spacing.sm, paddingTop: spacing.xl },
  backLink: { marginBottom: spacing.md },
  eyebrow: { letterSpacing: 2 },
  title: { marginTop: spacing.xs },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  hero: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    marginTop: spacing.xl,
  },
  heroImg: { width: "100%", height: "100%", objectFit: "cover" },
  body: { marginTop: spacing.xl },
});
