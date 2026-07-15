import { StyleSheet, View } from "react-native";
import { Link } from "expo-router";
import { Button, Txt, spacing, useResponsive } from "@chrono/ui";
import { useT } from "@/lib/i18n";
import { marketingDisplayFont } from "./MarketingFonts";

// Deliberately outside the light/dark palette — a fixed, high-contrast "statement"
// band used for the closing CTA on marketing pages, independent of theme scheme.
const INK = "#12101c";
const INK_MUTED = "#a6a1bd";
const PAPER = "#f4f2ee";

export interface StatementBandProps {
  title: string;
  subtitle?: string;
  ctaLabel: string;
}

/** Full-bleed dark "closing statement" CTA band shared by the landing page and article footers. */
export function StatementBand({ title, subtitle, ctaLabel }: StatementBandProps) {
  const t = useT();
  const { isWide } = useResponsive();

  return (
    <View
      style={[
        styles.band,
        { paddingVertical: isWide ? 96 : 64, paddingHorizontal: spacing.xl },
      ]}
    >
      <Txt
        variant="caption"
        mono
        uppercase
        color={PAPER}
        style={styles.eyebrow}
      >
        {t("landing.cta.eyebrow")}
      </Txt>
      <Txt
        variant={isWide ? "displayLg" : "display"}
        weight="bold"
        center
        color={PAPER}
        style={[styles.title, { fontFamily: marketingDisplayFont }]}
      >
        {title}
      </Txt>
      {subtitle ? (
        <Txt variant="body" center color={INK_MUTED} style={styles.subtitle}>
          {subtitle}
        </Txt>
      ) : null}
      <Link href="/(landing)/register" asChild>
        <Button title={ctaLabel} size="lg" fullWidth={!isWide} />
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { backgroundColor: INK, alignItems: "center", gap: spacing.md },
  eyebrow: { letterSpacing: 2 },
  title: { maxWidth: 640 },
  subtitle: { maxWidth: 460, marginBottom: spacing.sm },
});
