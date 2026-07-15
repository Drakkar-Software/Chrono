import type { Tables } from '../schema';

/** Per-locale string map, e.g. { en: 'Title', fr: 'Titre' }. */
export type LocaleMap = { [locale: string]: string };

/** Shape of a blog article's `content` jsonb — all fields optional/defensive. */
export type BlogArticleContent = {
  title_translations?: LocaleMap;
  excerpt_translations?: LocaleMap;
  content_translations?: LocaleMap;
  /** Optional per-locale SEO meta description; falls back to the excerpt. */
  description_translations?: LocaleMap;
};

/** A blog article row with its `content` typed as the translation bag. */
export type BlogArticle = Omit<Tables<'blog_articles'>, 'content'> & {
  content: BlogArticleContent | null;
};
