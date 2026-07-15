import Head from 'expo-router/head';

export interface SeoProps {
  title: string;
  description?: string;
  /** Absolute canonical URL. */
  url?: string;
  /** Absolute image URL for social cards. */
  image?: string;
  /** `website` (default) or `article`. */
  type?: 'website' | 'article';
  publishedTime?: string;
  /** JSON-LD structured data object (rendered as application/ld+json). */
  jsonLd?: Record<string, unknown>;
}

/**
 * Per-page SEO head: title, meta description, canonical, Open Graph, Twitter
 * card and optional JSON-LD. Renders into the document head on web (via
 * `expo-router/head`) and is a no-op on native.
 */
export function Seo({ title, description, url, image, type = 'website', publishedTime, jsonLd }: SeoProps) {
  return (
    <Head>
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      {url ? <link rel="canonical" href={url} /> : null}

      <meta property="og:site_name" content="Chrono" />
      <meta property="og:title" content={title} />
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:type" content={type} />
      {url ? <meta property="og:url" content={url} /> : null}
      {image ? <meta property="og:image" content={image} /> : null}
      {publishedTime ? <meta property="article:published_time" content={publishedTime} /> : null}

      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={title} />
      {description ? <meta name="twitter:description" content={description} /> : null}
      {image ? <meta name="twitter:image" content={image} /> : null}

      {jsonLd ? (
        // eslint-disable-next-line react-native/no-raw-text
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      ) : null}
    </Head>
  );
}
