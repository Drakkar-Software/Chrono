import { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Txt, spacing, useResponsive, useTheme } from "@chrono/ui";
import type { BlogArticle } from "@chrono/sdk";

import { useT, useLanguage } from "@/lib/i18n";
import { useBlogArticles } from "@/lib/hooks/use-blog";
import { absoluteUrl } from "@/lib/site";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { Seo } from "@/components/blog/Seo";
import {
  MarketingFonts,
  marketingDisplayFont,
} from "@/components/marketing/MarketingFonts";
import { MarketingNav } from "@/components/marketing/MarketingNav";

export default function BlogIndex() {
  const t = useT();
  const { locale } = useLanguage();
  const { colors } = useTheme();
  const { isWide } = useResponsive();
  const { data: articles, isLoading } = useBlogArticles();

  const formatDate = useCallback(
    (iso: string | null) =>
      new Date(iso || 0).toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [locale],
  );

  const list = articles ?? [];
  const [featuredArticle, ...restArticles] = list;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Chrono",
    url: absoluteUrl("/blog"),
    description: t("blog.metaDescription"),
    blogPost: list.map((a: BlogArticle) => ({
      "@type": "BlogPosting",
      headline:
        (a.content?.title_translations?.[locale] as string) ||
        (a.content?.title_translations?.en as string) ||
        a.slug,
      url: absoluteUrl(`/blog/${a.slug}`),
      datePublished: a.published_at,
    })),
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={styles.scroll}
    >
      <MarketingFonts />
      <Seo
        title={t("blog.metaTitle")}
        description={t("blog.metaDescription")}
        url={absoluteUrl("/blog")}
        jsonLd={jsonLd}
      />
      <MarketingNav />

      <View
        style={[styles.inner, { paddingHorizontal: isWide ? 64 : spacing.lg }]}
      >
        <View style={styles.hero}>
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
            {t("blog.title")}
          </Txt>
          <Txt variant="body" tone="textMuted" style={styles.lede}>
            {t("blog.lede")}
          </Txt>
        </View>

        {isLoading && list.length === 0 ? (
          <Txt variant="body" tone="textMuted">
            {t("blog.loading")}
          </Txt>
        ) : list.length === 0 ? (
          <Txt variant="body" tone="textMuted">
            {t("blog.empty")}
          </Txt>
        ) : (
          <>
            <ArticleCard
              article={featuredArticle}
              locale={locale}
              formatDate={formatDate}
              featured
            />

            {restArticles.length > 0 ? (
              <View style={styles.moreSection}>
                <Txt
                  variant="label"
                  mono
                  uppercase
                  tone="textFaint"
                  style={styles.moreLabel}
                >
                  {t("blog.moreArticles")}
                </Txt>
                <View style={[styles.grid, isWide && styles.gridWide]}>
                  {restArticles.map((a) => (
                    <View
                      key={a.id}
                      style={isWide ? styles.colWide : styles.col}
                    >
                      <ArticleCard
                        article={a}
                        locale={locale}
                        formatDate={formatDate}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: spacing.xxl },
  inner: {
    width: "100%",
    maxWidth: 1080,
    alignSelf: "center",
    gap: spacing.xxl,
    paddingVertical: spacing.xxl,
  },
  eyebrow: { letterSpacing: 2 },
  hero: { gap: spacing.sm, maxWidth: 720 },
  title: { marginTop: spacing.xs },
  lede: { maxWidth: 640 },
  moreSection: { gap: spacing.lg },
  moreLabel: { letterSpacing: 1.5 },
  grid: { gap: spacing.lg },
  gridWide: { flexDirection: "row", flexWrap: "wrap" },
  col: { width: "100%" },
  colWide: { width: "31.5%", minWidth: 280, flexGrow: 1 },
});
