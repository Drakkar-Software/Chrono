import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  Txt,
  useResponsive,
  useTheme,
  borders,
  radii,
  spacing,
} from "@chrono/ui";
import { useT } from "@/lib/i18n";
import {
  MarketingFonts,
  marketingDisplayFont,
} from "@/components/marketing/MarketingFonts";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { LedgerCard } from "@/components/marketing/LedgerCard";
import { StatementBand } from "@/components/marketing/StatementBand";

type Feature = {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  bodyKey: string;
};

const FEATURES: Feature[] = [
  {
    icon: "time-outline",
    titleKey: "landing.feature.logTime.title",
    bodyKey: "landing.feature.logTime.body",
  },
  {
    icon: "checkmark-done-outline",
    titleKey: "landing.feature.approvals.title",
    bodyKey: "landing.feature.approvals.body",
  },
  {
    icon: "receipt-outline",
    titleKey: "landing.feature.invoices.title",
    bodyKey: "landing.feature.invoices.body",
  },
  {
    icon: "trending-up-outline",
    titleKey: "landing.feature.revenue.title",
    bodyKey: "landing.feature.revenue.body",
  },
  {
    icon: "people-outline",
    titleKey: "landing.feature.referral.title",
    bodyKey: "landing.feature.referral.body",
  },
  {
    icon: "business-outline",
    titleKey: "landing.feature.companies.title",
    bodyKey: "landing.feature.companies.body",
  },
];

const STEPS: {
  n: string;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  bodyKey: string;
}[] = [
  {
    n: "01",
    icon: "time-outline",
    titleKey: "landing.step.log.title",
    bodyKey: "landing.step.log.body",
  },
  {
    n: "02",
    icon: "checkmark-done-outline",
    titleKey: "landing.step.approve.title",
    bodyKey: "landing.step.approve.body",
  },
  {
    n: "03",
    icon: "receipt-outline",
    titleKey: "landing.step.invoice.title",
    bodyKey: "landing.step.invoice.body",
  },
  {
    n: "04",
    icon: "trending-up-outline",
    titleKey: "landing.step.settle.title",
    bodyKey: "landing.step.settle.body",
  },
];

/** Apply CSS-only web properties (gradients) without breaking native. */
const webCss = (css: Record<string, string | number>) =>
  Platform.OS === "web" ? (css as object) : undefined;

/** Marketing landing page — asymmetric ledger-themed hero, features, how-it-works, CTA. */
export default function Landing() {
  const t = useT();
  const { colors } = useTheme();
  const { isWide } = useResponsive();
  const year = new Date().getFullYear();

  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <MarketingFonts />
      <MarketingNav />

      {/* ─── Hero ─── */}
      <View
        style={[
          styles.hero,
          {
            flexDirection: isWide ? "row" : "column",
            paddingVertical: isWide ? 96 : 56,
            paddingHorizontal: isWide ? 64 : spacing.xl,
          },
          webCss({
            backgroundImage: `radial-gradient(50% 60% at ${isWide ? "20%" : "50%"} 0%, ${colors.accentBg}, transparent 70%)`,
          }),
        ]}
      >
        <View style={[styles.heroCopy, !isWide && styles.heroCopyNarrow]}>
          <Txt
            variant="caption"
            mono
            uppercase
            tone="accent"
            style={styles.eyebrow}
          >
            {t("landing.hero.eyebrow")}
          </Txt>
          <Txt
            variant={isWide ? "displayLg" : "display"}
            weight="bold"
            center={!isWide}
            style={[
              styles.headline,
              {
                fontFamily: marketingDisplayFont,
                maxWidth: isWide ? 560 : 480,
              },
            ]}
          >
            {t("landing.hero.tagline")}
          </Txt>
          <Txt
            variant="body"
            tone="textMuted"
            center={!isWide}
            style={[styles.blurb, { maxWidth: isWide ? 480 : 520 }]}
          >
            {t("landing.hero.blurb")}
          </Txt>

          <View style={[styles.ctaRow, !isWide && styles.ctaRowStacked]}>
            <Link href="/(landing)/register" asChild>
              <Button
                title={t("landing.hero.getStarted")}
                size="lg"
                fullWidth={!isWide}
              />
            </Link>
            <Link href="/(landing)/login" asChild>
              <Button
                title={t("auth.signIn")}
                variant="secondary"
                size="lg"
                fullWidth={!isWide}
              />
            </Link>
          </View>

          <View style={[styles.trustRow, !isWide && styles.trustRowCenter]}>
            <Ionicons
              name="lock-closed-outline"
              size={13}
              color={colors.textFaint}
            />
            <Txt
              variant="caption"
              mono
              tone="textFaint"
              style={styles.trustText}
            >
              {t("landing.hero.trust")}
            </Txt>
          </View>
        </View>

        <View style={[styles.heroVisual, !isWide && styles.heroVisualNarrow]}>
          <LedgerCard />
        </View>
      </View>

      {/* ─── Features ─── */}
      <View
        style={[
          styles.section,
          {
            backgroundColor: colors.surface,
            paddingHorizontal: isWide ? 64 : spacing.xl,
          },
        ]}
      >
        <View style={styles.sectionHead}>
          <Txt
            variant="caption"
            mono
            uppercase
            tone="accent"
            style={styles.eyebrow}
          >
            {t("landing.features.eyebrow")}
          </Txt>
          <Txt
            variant="displayLg"
            weight="bold"
            style={[styles.sectionTitle, { fontFamily: marketingDisplayFont }]}
          >
            {t("landing.features.title")}
          </Txt>
        </View>

        <View style={styles.ledgerList}>
          {FEATURES.map((f, i) => (
            <View
              key={f.titleKey}
              style={[
                styles.featureRow,
                {
                  borderTopColor: colors.border,
                  flexBasis: isWide ? "48%" : "100%",
                },
              ]}
            >
              <Txt
                variant="caption"
                mono
                tone="textFaint"
                style={styles.featureIndex}
              >
                {String(i + 1).padStart(2, "0")}
              </Txt>
              <View
                style={[
                  styles.featureIcon,
                  {
                    backgroundColor: colors.accentBg,
                    borderColor: colors.accentBorder,
                    borderRadius: radii.md,
                  },
                ]}
              >
                <Ionicons name={f.icon} size={18} color={colors.accent} />
              </View>
              <View style={styles.featureBody}>
                <Txt
                  variant="heading"
                  weight="semibold"
                  style={styles.featureTitle}
                >
                  {t(f.titleKey)}
                </Txt>
                <Txt variant="body" tone="textMuted">
                  {t(f.bodyKey)}
                </Txt>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ─── How it works ─── */}
      <View
        style={[
          styles.section,
          { paddingHorizontal: isWide ? 64 : spacing.xl },
        ]}
      >
        <View style={styles.sectionHead}>
          <Txt
            variant="caption"
            mono
            uppercase
            tone="accent"
            style={styles.eyebrow}
          >
            {t("landing.how.eyebrow")}
          </Txt>
          <Txt
            variant="displayLg"
            weight="bold"
            style={[styles.sectionTitle, { fontFamily: marketingDisplayFont }]}
          >
            {t("landing.how.title")}
          </Txt>
        </View>

        <View
          style={[
            styles.timeline,
            { flexDirection: isWide ? "row" : "column" },
          ]}
        >
          {isWide ? (
            <View
              style={[styles.timelineRule, { backgroundColor: colors.border }]}
            />
          ) : null}
          {STEPS.map((s) => (
            <View
              key={s.n}
              style={[styles.step, isWide && { flexBasis: "25%" }]}
            >
              <View
                style={[
                  styles.stepBadge,
                  {
                    backgroundColor: colors.canvas,
                    borderColor: colors.accent,
                  },
                ]}
              >
                <Ionicons name={s.icon} size={18} color={colors.accent} />
              </View>
              <Txt
                variant="micro"
                mono
                tone="textFaint"
                style={styles.stepIndex}
              >
                {s.n} / 04
              </Txt>
              <Txt variant="heading" weight="semibold" style={styles.stepTitle}>
                {t(s.titleKey)}
              </Txt>
              <Txt variant="caption" tone="textMuted">
                {t(s.bodyKey)}
              </Txt>
            </View>
          ))}
        </View>
      </View>

      {/* ─── Bottom CTA ─── */}
      <StatementBand
        title={t("landing.cta.title")}
        subtitle={t("landing.cta.subtitle")}
        ctaLabel={t("auth.createAccount")}
      />

      {/* ─── Footer ─── */}
      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border,
            paddingHorizontal: isWide ? 64 : spacing.xl,
          },
        ]}
      >
        <View style={styles.footerBrand}>
          <Ionicons name="stopwatch-outline" size={18} color={colors.accent} />
          <Txt variant="caption" weight="semibold" tone="textMuted">
            Chrono
          </Txt>
        </View>
        <Link href="/blog" asChild>
          <Txt
            variant="caption"
            weight="semibold"
            tone="accent"
            accessibilityRole="link"
          >
            {t("blog.eyebrow")}
          </Txt>
        </Link>
        <Txt variant="caption" mono tone="textFaint">
          {t("landing.footer.copyright", { year })}
        </Txt>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1 },

  hero: { alignItems: "center", justifyContent: "center", gap: spacing.xxl },
  heroCopy: {
    flex: 1,
    maxWidth: 560,
    alignItems: "flex-start",
    gap: spacing.md,
  },
  heroCopyNarrow: { flex: undefined, alignItems: "center", maxWidth: "100%" },
  heroVisual: { flexShrink: 0 },
  heroVisualNarrow: { width: "100%", alignItems: "center" },
  eyebrow: { letterSpacing: 2 },
  headline: { marginTop: spacing.xs, letterSpacing: -0.5 },
  blurb: { marginTop: spacing.xs },
  ctaRow: {
    marginTop: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
  },
  ctaRowStacked: { flexDirection: "column", maxWidth: 320 },
  trustRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    maxWidth: "100%",
  },
  trustRowCenter: { justifyContent: "center" },
  trustText: { flexShrink: 1 },

  section: { paddingVertical: 88, alignItems: "center" },
  sectionHead: { width: "100%", maxWidth: 1080, marginBottom: spacing.xxl },
  sectionTitle: { marginTop: spacing.xs, maxWidth: 620, letterSpacing: -0.5 },

  ledgerList: {
    width: "100%",
    maxWidth: 1080,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xl,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: borders.thin,
    minWidth: 260,
  },
  featureIndex: { width: 20, marginTop: 2 },
  featureIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: borders.thin,
    flexShrink: 0,
  },
  featureBody: { flex: 1, gap: spacing.xs, minWidth: 0 },
  featureTitle: {},

  timeline: {
    width: "100%",
    maxWidth: 1080,
    gap: spacing.xl,
    position: "relative",
  },
  timelineRule: { position: "absolute", top: 19, left: 0, right: 0, height: 1 },
  step: {
    alignItems: "flex-start",
    gap: spacing.xs,
    minWidth: 200,
    paddingRight: spacing.lg,
  },
  stepBadge: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: borders.thick,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  stepIndex: { letterSpacing: 1 },
  stepTitle: {},

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    flexWrap: "wrap",
    gap: spacing.md,
  },
  footerBrand: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
});
