import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

/**
 * Web-only root HTML document, used for every page during static rendering.
 * Runs in Node at export time (no DOM/browser APIs). Per-page <title>/meta come
 * from each screen's <Seo> (expo-router/head); this holds the global defaults.
 */
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta
          name="description"
          content="Chrono is a multi-tenant app to track freelance time, recognize project revenue and pay freelancers by invoice with funding-limited, carry-forward settlement."
        />
        <meta name="theme-color" content="#f3f2ef" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#16150f" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Chrono" />
        <meta property="og:site_name" content="Chrono" />
        <meta property="og:type" content="website" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: '#root { flex-direction: column; }' }} />
        <style dangerouslySetInnerHTML={{ __html: rootBackground }} />
        <style dangerouslySetInnerHTML={{ __html: fontFaces }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Avoid a background flash before hydration in either color scheme — mirrors
// theme.ts `canvas` for light/dark so the pre-hydration paint matches the app.
const rootBackground = `
body { background-color: #f3f2ef; }
@media (prefers-color-scheme: dark) { body { background-color: #16150f; } }
`;

// Self-hosted Geist / Geist Mono, one @font-face per weight, registered under
// the SAME family names theme.ts's `fontFamilies` map uses on native — so
// `<Txt>` resolves to the identical family on web and native. `font-weight:
// normal` on every face: the family name alone selects the weight (see
// theme.ts `fontFamilyFor`), matching how native custom fonts work.
const fontFaces = `
@font-face { font-family: 'Geist-Regular'; src: url('/fonts/Geist-Regular.ttf') format('truetype'); font-weight: normal; font-style: normal; font-display: swap; }
@font-face { font-family: 'Geist-Medium'; src: url('/fonts/Geist-Medium.ttf') format('truetype'); font-weight: normal; font-style: normal; font-display: swap; }
@font-face { font-family: 'Geist-SemiBold'; src: url('/fonts/Geist-SemiBold.ttf') format('truetype'); font-weight: normal; font-style: normal; font-display: swap; }
@font-face { font-family: 'Geist-Bold'; src: url('/fonts/Geist-Bold.ttf') format('truetype'); font-weight: normal; font-style: normal; font-display: swap; }
@font-face { font-family: 'GeistMono-Regular'; src: url('/fonts/GeistMono-Regular.ttf') format('truetype'); font-weight: normal; font-style: normal; font-display: swap; }
@font-face { font-family: 'GeistMono-Medium'; src: url('/fonts/GeistMono-Medium.ttf') format('truetype'); font-weight: normal; font-style: normal; font-display: swap; }
@font-face { font-family: 'GeistMono-SemiBold'; src: url('/fonts/GeistMono-SemiBold.ttf') format('truetype'); font-weight: normal; font-style: normal; font-display: swap; }
@font-face { font-family: 'GeistMono-Bold'; src: url('/fonts/GeistMono-Bold.ttf') format('truetype'); font-weight: normal; font-style: normal; font-display: swap; }
`;
