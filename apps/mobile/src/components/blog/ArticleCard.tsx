import { Pressable, StyleSheet, View } from "react-native";
import { Link } from "expo-router";
import {
  Txt,
  borders,
  radii,
  spacing,
  useResponsive,
  useTheme,
} from "@chrono/ui";
import { getBlogArticleTranslation } from "@chrono/sdk";
import type { BlogArticle } from "@chrono/sdk";
import { useT } from "@/lib/i18n";
import { marketingDisplayFont } from "@/components/marketing/MarketingFonts";

export interface ArticleCardProps {
  article: BlogArticle;
  locale: string;
  formatDate: (iso: string | null) => string;
  /** Renders as a large side-by-side card (index-page hero slot). Default false. */
  featured?: boolean;
}

/** A blog index card: optional cover, title, excerpt, date + read time. */
export function ArticleCard({
  article,
  locale,
  formatDate,
  featured = false,
}: ArticleCardProps) {
  const t = useT();
  const { colors } = useTheme();
  const { isWide } = useResponsive();
  const tr = getBlogArticleTranslation(article.content, locale);
  const readLabel = article.read_time
    ? t("blog.readTime", { n: article.read_time })
    : null;
  const wideFeatured = featured && isWide;

  return (
    <Link href={`/blog/${article.slug}`} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={tr.title}
        style={({ pressed }) => [
          styles.card,
          wideFeatured && styles.cardFeatured,
          {
            backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {article.image_url ? (
          <View
            style={[
              wideFeatured ? styles.coverFeatured : styles.cover,
              { backgroundColor: colors.fill },
            ]}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <img
              src={article.image_url}
              alt=""
              style={styles.coverImg as any}
            />
          </View>
        ) : null}
        <View style={[styles.body, wideFeatured && styles.bodyFeatured]}>
          {featured ? (
            <Txt
              variant="micro"
              mono
              uppercase
              tone="accent"
              style={styles.featuredLabel}
            >
              {t("blog.featured")}
            </Txt>
          ) : null}
          <Txt
            variant={wideFeatured ? "displayLg" : "heading"}
            weight="bold"
            numberOfLines={featured ? 3 : 2}
            style={
              featured
                ? { fontFamily: marketingDisplayFont, letterSpacing: -0.5 }
                : undefined
            }
          >
            {tr.title}
          </Txt>
          {tr.excerpt ? (
            <Txt variant="body" tone="textMuted" numberOfLines={featured ? 4 : 3}>
              {tr.excerpt}
            </Txt>
          ) : null}
          <View style={styles.meta}>
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
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: borders.thin,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  cardFeatured: { flexDirection: "row", alignItems: "stretch" },
  cover: { width: "100%", aspectRatio: 16 / 9 },
  coverFeatured: { flex: 1, minWidth: 0 },
  coverImg: { width: "100%", height: "100%", objectFit: "cover" },
  body: { gap: spacing.sm, padding: spacing.lg },
  bodyFeatured: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xxl,
    gap: spacing.md,
  },
  featuredLabel: { letterSpacing: 1.5 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
