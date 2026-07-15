import { Platform, StyleSheet, View } from "react-native";
import { Link } from "expo-router";
import {
  BrandMark,
  Button,
  Txt,
  borders,
  spacing,
  useResponsive,
  useTheme,
} from "@chrono/ui";
import { useT } from "@/lib/i18n";
import { marketingDisplayFont } from "./MarketingFonts";

/** Sticky-on-web marketing header shared by the landing and blog surfaces. */
export function MarketingNav() {
  const t = useT();
  const { colors } = useTheme();
  const { isWide } = useResponsive();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.canvas,
          borderBottomColor: colors.border,
          paddingHorizontal: isWide ? 64 : spacing.lg,
        },
        Platform.OS === "web"
          ? ({ position: "sticky", top: 0, zIndex: 20 } as object)
          : null,
      ]}
    >
      <Link href="/" asChild>
        <View accessibilityRole="link" style={styles.brand}>
          <BrandMark size={28} shadow={false} />
          <Txt
            variant="heading"
            weight="bold"
            style={{ fontFamily: marketingDisplayFont }}
          >
            Chrono
          </Txt>
        </View>
      </Link>

      <View style={styles.links}>
        <Link href="/blog" asChild>
          <Txt
            variant="bodyMedium"
            weight="semibold"
            tone="textMuted"
            accessibilityRole="link"
            style={styles.link}
          >
            {t("nav.blog")}
          </Txt>
        </Link>
        {isWide ? (
          <Link href="/(landing)/login" asChild>
            <Txt
              variant="bodyMedium"
              weight="semibold"
              tone="textMuted"
              accessibilityRole="link"
              style={styles.link}
            >
              {t("auth.signIn")}
            </Txt>
          </Link>
        ) : null}
        <Link href="/(landing)/register" asChild>
          <Button title={t("nav.getStarted")} size="sm" />
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 60,
    borderBottomWidth: borders.hairline,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  links: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  link: { paddingVertical: spacing.xs },
});
