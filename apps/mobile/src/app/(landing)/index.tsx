import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Txt,
  useResponsive,
  useTheme,
  radii,
  shadows,
  spacing,
} from '@chrono/ui';
import { useT } from '@/lib/i18n';

type Feature = { icon: keyof typeof Ionicons.glyphMap; titleKey: string; bodyKey: string };

const FEATURES: Feature[] = [
  {
    icon: 'time-outline',
    titleKey: 'landing.feature.logTime.title',
    bodyKey: 'landing.feature.logTime.body',
  },
  {
    icon: 'checkmark-done-outline',
    titleKey: 'landing.feature.approvals.title',
    bodyKey: 'landing.feature.approvals.body',
  },
  {
    icon: 'receipt-outline',
    titleKey: 'landing.feature.invoices.title',
    bodyKey: 'landing.feature.invoices.body',
  },
  {
    icon: 'trending-up-outline',
    titleKey: 'landing.feature.revenue.title',
    bodyKey: 'landing.feature.revenue.body',
  },
  {
    icon: 'people-outline',
    titleKey: 'landing.feature.referral.title',
    bodyKey: 'landing.feature.referral.body',
  },
  {
    icon: 'business-outline',
    titleKey: 'landing.feature.companies.title',
    bodyKey: 'landing.feature.companies.body',
  },
];

const STEPS: { n: string; titleKey: string; bodyKey: string }[] = [
  { n: '1', titleKey: 'landing.step.log.title', bodyKey: 'landing.step.log.body' },
  { n: '2', titleKey: 'landing.step.approve.title', bodyKey: 'landing.step.approve.body' },
  { n: '3', titleKey: 'landing.step.invoice.title', bodyKey: 'landing.step.invoice.body' },
  { n: '4', titleKey: 'landing.step.settle.title', bodyKey: 'landing.step.settle.body' },
];

/** Apply CSS-only web properties (gradients) without breaking native. */
const webCss = (css: Record<string, string | number>) =>
  Platform.OS === 'web' ? (css as object) : undefined;

/** Marketing landing page — responsive hero, features, how-it-works, CTA, footer. */
export default function Landing() {
  const t = useT();
  const { colors } = useTheme();
  const { isWide } = useResponsive();
  const year = 2026;

  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Hero ─── */}
      <View
        style={[
          styles.hero,
          { paddingVertical: isWide ? 112 : 72, paddingHorizontal: spacing.xl },
          webCss({
            backgroundImage: `radial-gradient(60% 55% at 50% 0%, ${colors.accentBg}, transparent 70%)`,
          }),
        ]}
      >
        <View style={[styles.brandMark, { backgroundColor: colors.accent, ...shadows.lg }]}>
          <Ionicons name="stopwatch-outline" size={isWide ? 46 : 38} color={colors.accentText} />
        </View>

        <Txt variant={isWide ? 'displayXl' : 'displayLg'} center>
          Chrono
        </Txt>
        <Txt
          variant="title"
          weight="regular"
          center
          style={[styles.tagline, { maxWidth: isWide ? 620 : 420 }]}
        >
          {t('landing.hero.tagline')}
        </Txt>
        <Txt variant="body" tone="textMuted" center style={styles.blurb}>
          {t('landing.hero.blurb')}
        </Txt>

        <View style={[styles.ctaRow, !isWide && styles.ctaRowStacked]}>
          <Link href="/(landing)/register" asChild>
            <Button title={t('landing.hero.getStarted')} size="lg" fullWidth={!isWide} />
          </Link>
          <Link href="/(landing)/login" asChild>
            <Button title={t('auth.signIn')} variant="secondary" size="lg" fullWidth={!isWide} />
          </Link>
        </View>

        <View style={styles.trustRow}>
          <Ionicons name="lock-closed-outline" size={13} color={colors.textFaint} />
          <Txt variant="caption" tone="textFaint" center style={styles.trustText}>
            {t('landing.hero.trust')}
          </Txt>
        </View>
      </View>

      {/* ─── Features ─── */}
      <View
        style={[
          styles.section,
          { backgroundColor: colors.surface, paddingHorizontal: isWide ? 64 : spacing.xl },
        ]}
      >
        <Txt variant="caption" mono uppercase tone="accent" center style={styles.eyebrow}>
          {t('landing.features.eyebrow')}
        </Txt>
        <Txt variant="display" weight="bold" center style={styles.sectionTitle}>
          {t('landing.features.title')}
        </Txt>

        <View style={styles.grid}>
          {FEATURES.map((f) => (
            <View
              key={f.titleKey}
              style={[
                styles.featureCard,
                {
                  backgroundColor: colors.canvas,
                  borderColor: colors.border,
                  borderRadius: radii.lg,
                  flexBasis: isWide ? '30%' : '100%',
                },
              ]}
            >
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
                <Ionicons name={f.icon} size={20} color={colors.accent} />
              </View>
              <Txt variant="heading" weight="semibold" style={styles.featureTitle}>
                {t(f.titleKey)}
              </Txt>
              <Txt variant="body" tone="textMuted">
                {t(f.bodyKey)}
              </Txt>
            </View>
          ))}
        </View>
      </View>

      {/* ─── How it works ─── */}
      <View style={[styles.section, { paddingHorizontal: isWide ? 64 : spacing.xl }]}>
        <Txt variant="caption" mono uppercase tone="accent" center style={styles.eyebrow}>
          {t('landing.how.eyebrow')}
        </Txt>
        <Txt variant="display" weight="bold" center style={styles.sectionTitle}>
          {t('landing.how.title')}
        </Txt>
        <View style={[styles.steps, { flexDirection: isWide ? 'row' : 'column' }]}>
          {STEPS.map((s) => (
            <View key={s.n} style={[styles.step, { flexBasis: isWide ? '22%' : '100%' }]}>
              <View style={[styles.stepBadge, { backgroundColor: colors.accent }]}>
                <Txt variant="heading" weight="bold" color={colors.accentText}>
                  {s.n}
                </Txt>
              </View>
              <Txt variant="heading" weight="semibold" center style={styles.stepTitle}>
                {t(s.titleKey)}
              </Txt>
              <Txt variant="caption" tone="textMuted" center>
                {t(s.bodyKey)}
              </Txt>
            </View>
          ))}
        </View>
      </View>

      {/* ─── Bottom CTA ─── */}
      <View style={[styles.ctaSection, { paddingHorizontal: spacing.xl }]}>
        <View
          style={[
            styles.ctaCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.accentBorder,
              borderRadius: radii.lg,
              ...shadows.lg,
              padding: isWide ? 48 : spacing.xxl,
            },
          ]}
        >
          <Txt variant="display" weight="bold" center>
            {t('landing.cta.title')}
          </Txt>
          <Txt variant="body" tone="textMuted" center style={styles.ctaBlurb}>
            {t('landing.cta.subtitle')}
          </Txt>
          <Link href="/(landing)/register" asChild>
            <Button title={t('auth.createAccount')} size="lg" fullWidth={!isWide} />
          </Link>
        </View>
      </View>

      {/* ─── Footer ─── */}
      <View
        style={[
          styles.footer,
          { borderTopColor: colors.border, paddingHorizontal: isWide ? 64 : spacing.xl },
        ]}
      >
        <View style={styles.footerBrand}>
          <Ionicons name="stopwatch-outline" size={18} color={colors.accent} />
          <Txt variant="caption" weight="semibold" tone="textMuted">
            Chrono
          </Txt>
        </View>
        <Txt variant="caption" tone="textFaint">
          {t('landing.footer.copyright', { year })}
        </Txt>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1 },

  hero: { alignItems: 'center', gap: spacing.md },
  brandMark: {
    width: 88,
    height: 88,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  tagline: { marginTop: spacing.sm, textAlign: 'center' },
  blurb: { marginTop: spacing.sm, maxWidth: 560, textAlign: 'center' },
  ctaRow: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    justifyContent: 'center',
  },
  ctaRowStacked: { flexDirection: 'column', maxWidth: 320 },
  trustRow: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    maxWidth: '100%',
  },
  trustText: { flexShrink: 1 },

  section: { paddingVertical: 72, alignItems: 'center' },
  eyebrow: { letterSpacing: 2, marginBottom: spacing.md },
  sectionTitle: { marginBottom: spacing.xl, textAlign: 'center' },

  grid: {
    width: '100%',
    maxWidth: 1080,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
  featureCard: { flexGrow: 1, padding: spacing.xl, borderWidth: 1, minWidth: 240 },
  featureIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  featureTitle: { marginBottom: spacing.xs },

  steps: { width: '100%', maxWidth: 1000, gap: spacing.lg, justifyContent: 'center' },
  step: { flexGrow: 1, alignItems: 'center', gap: spacing.xs, minWidth: 200 },
  stepBadge: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  stepTitle: {},

  ctaSection: { paddingVertical: 72, alignItems: 'center' },
  ctaCard: { width: '100%', maxWidth: 620, alignItems: 'center', gap: spacing.md, borderWidth: 1 },
  ctaBlurb: { marginBottom: spacing.md },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  footerBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
