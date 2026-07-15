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
        <meta name="theme-color" content="#0f766e" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Chrono" />
        <meta property="og:site_name" content="Chrono" />
        <meta property="og:type" content="website" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: '#root { flex-direction: column; }' }} />
        <style dangerouslySetInnerHTML={{ __html: rootBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Avoid a background flash before hydration in either color scheme.
const rootBackground = `
body { background-color: #ffffff; }
@media (prefers-color-scheme: dark) { body { background-color: #0b1220; } }
`;
