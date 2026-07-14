import { StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { Button, Screen, Txt, spacing } from '@chrono/ui';

/** Marketing hero for the web landing page. */
export default function Landing() {
  return (
    <Screen>
      <View style={styles.hero}>
        <Txt variant="displayLg" center>
          Chrono
        </Txt>
        <Txt variant="title" tone="textMuted" center style={styles.tagline}>
          Track your freelance time and get paid.
        </Txt>
        <Txt variant="body" tone="textMuted" center style={styles.blurb}>
          Log hours against projects, send them for approval, and turn approved time into
          invoices — with revenue, referrals and margins handled for you.
        </Txt>
        <View style={styles.actions}>
          <Link href="/(landing)/register" asChild>
            <Button title="Get started" size="lg" />
          </Link>
          <Link href="/(landing)/login" asChild>
            <Button title="Sign in" variant="secondary" size="lg" />
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  tagline: { marginTop: spacing.sm },
  blurb: { marginTop: spacing.sm, maxWidth: 480 },
  actions: { marginTop: spacing.xl, gap: spacing.md, width: '100%', maxWidth: 320 },
});
