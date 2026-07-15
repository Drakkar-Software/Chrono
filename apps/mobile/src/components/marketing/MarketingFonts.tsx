import { Platform } from "react-native";
import Head from "expo-router/head";
import { fonts } from "@chrono/ui";

/**
 * Loads the "Fraunces" display serif for marketing surfaces (landing, blog).
 * No-op on native (`expo-router/head` only renders into the web document head);
 * the rest of the app keeps the system font stack untouched.
 */
export function MarketingFonts() {
  return (
    <Head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,440;9..144,560;9..144,640;9..144,700&display=swap"
      />
    </Head>
  );
}

/**
 * Display font for marketing headlines — Fraunces on web (loaded by
 * {@link MarketingFonts}), the app's system display face on native (where no
 * webfont is linked).
 */
export const marketingDisplayFont =
  Platform.OS === "web"
    ? '"Fraunces", ui-serif, Georgia, "Times New Roman", serif'
    : fonts.display;
