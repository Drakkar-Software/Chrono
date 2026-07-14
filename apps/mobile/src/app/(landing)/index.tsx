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

type Feature = { icon: keyof typeof Ionicons.glyphMap; title: string; body: string };

const FEATURES: Feature[] = [
  {
    icon: 'time-outline',
    title: 'Log time your way',
    body: 'Enter hours against the projects you are assigned to. Days and amounts are computed from each project rate.',
  },
  {
    icon: 'checkmark-done-outline',
    title: 'Approvals built in',
    body: 'Managers review and approve logged time before a single euro is billed. Nothing slips through.',
  },
  {
    icon: 'receipt-outline',
    title: 'Invoices & carry-forward',
    body: 'Turn approved time into monthly invoices. When funding is short, the balance is credited to the next period automatically.',
  },
  {
    icon: 'trending-up-outline',
    title: 'Revenue sources',
    body: 'Fund projects from time & materials contracts, recurring retainers or self-billing — recognized month by month.',
  },
  {
    icon: 'people-outline',
    title: 'Referral earnings',
    body: 'Bring a client and earn a share of project revenue every period — paid off the top before anyone else settles.',
  },
  {
    icon: 'business-outline',
    title: 'Multiple companies',
    body: 'One account, many companies. Switch between the teams you work with and keep every project cleanly separated.',
  },
];

const STEPS: { n: string; title: string; body: string }[] = [
  { n: '1', title: 'Log hours', body: 'Freelancers record time against their assigned projects.' },
  { n: '2', title: 'Approve', body: 'Managers approve billable time for the month.' },
  { n: '3', title: 'Invoice', body: 'Approved time becomes a monthly invoice at each freelancer’s rate.' },
  { n: '4', title: 'Settle', body: 'Invoices are paid from recognized project revenue, FIFO.' },
];

/** Apply CSS-only web properties (gradients) without breaking native. */
const webCss = (css: Record<string, string | number>) =>
  Platform.OS === 'web' ? (css as object) : undefined;

/** Marketing landing page — responsive hero, features, how-it-works, CTA, footer. */
export default function Landing() {
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
          style={[styles.tagline, { maxWidth: isWide ? 620 : 420, fontSize: isWide ? 24 : 20 }]}
        >
          Track freelance time, recognize revenue, and get everyone paid.
        </Txt>
        <Txt variant="body" tone="textMuted" center style={styles.blurb}>
          Chrono is the time-tracking and invoicing workspace for companies running multiple
          freelancers across multiple projects — with approvals, revenue sources, referrals and
          funding-aware settlement handled end to end.
        </Txt>

        <View style={[styles.ctaRow, !isWide && styles.ctaRowStacked]}>
          <Link href="/(landing)/register" asChild>
            <Button title="Get started" size="lg" fullWidth={!isWide} />
          </Link>
          <Link href="/(landing)/login" asChild>
            <Button title="Sign in" variant="secondary" size="lg" fullWidth={!isWide} />
          </Link>
        </View>

        <View style={styles.trustRow}>
          <Ionicons name="lock-closed-outline" size={13} color={colors.textFaint} />
          <Txt variant="caption" tone="textFaint">
            Multi-tenant · Offline-first · iOS · Android · Web
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
          Why Chrono
        </Txt>
        <Txt variant="display" weight="bold" center style={styles.sectionTitle}>
          Everything from a logged hour{'\n'}to a settled invoice.
        </Txt>

        <View style={styles.grid}>
          {FEATURES.map((f) => (
            <View
              key={f.title}
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
                {f.title}
              </Txt>
              <Txt variant="body" tone="textMuted">
                {f.body}
              </Txt>
            </View>
          ))}
        </View>
      </View>

      {/* ─── How it works ─── */}
      <View style={[styles.section, { paddingHorizontal: isWide ? 64 : spacing.xl }]}>
        <Txt variant="caption" mono uppercase tone="accent" center style={styles.eyebrow}>
          How it works
        </Txt>
        <Txt variant="display" weight="bold" center style={styles.sectionTitle}>
          Four steps, one clear flow.
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
                {s.title}
              </Txt>
              <Txt variant="caption" tone="textMuted" center>
                {s.body}
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
            Ready to bill your time?
          </Txt>
          <Txt variant="body" tone="textMuted" center style={styles.ctaBlurb}>
            Set up your company and first project in minutes.
          </Txt>
          <Link href="/(landing)/register" asChild>
            <Button title="Create your account" size="lg" fullWidth={!isWide} />
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
          © {year} Drakkar Software
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
  trustRow: { marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

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
