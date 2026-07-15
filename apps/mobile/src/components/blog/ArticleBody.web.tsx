import { markdownToHtml } from '@chrono/sdk';
import { useTheme } from '@chrono/ui';

/**
 * Web article renderer: converts the article markdown to semantic HTML so
 * crawlers and screen readers get real headings/paragraphs/lists, styled with
 * the current theme colors via a scoped stylesheet.
 */
export function ArticleBody({ markdown }: { markdown: string }) {
  const { colors } = useTheme();
  const html = markdownToHtml(markdown);

  const css = `
    .chrono-article { color: ${colors.text}; font-size: 18px; line-height: 1.75; }
    .chrono-article h1 { font-size: 30px; line-height: 1.2; margin: 32px 0 14px; color: ${colors.text}; }
    .chrono-article h2 { font-size: 24px; line-height: 1.25; margin: 28px 0 12px; color: ${colors.text}; }
    .chrono-article h3 { font-size: 20px; line-height: 1.3; margin: 22px 0 8px; color: ${colors.text}; }
    .chrono-article p { margin: 0 0 18px; color: ${colors.textMuted}; }
    .chrono-article ul, .chrono-article ol { margin: 0 0 18px; padding-left: 22px; color: ${colors.textMuted}; }
    .chrono-article li { margin: 0 0 6px; }
    .chrono-article strong { color: ${colors.text}; font-weight: 600; }
    .chrono-article a { color: ${colors.accent}; text-decoration: underline; }
    .chrono-article blockquote { margin: 24px 0; padding: 4px 0 4px 18px; border-left: 3px solid ${colors.accent}; font-style: italic; color: ${colors.text}; }
    .chrono-article code { background: ${colors.fill}; border-radius: 4px; padding: 2px 6px; font-size: 15px; }
    .chrono-article hr { border: none; border-top: 1px solid ${colors.border}; margin: 28px 0; }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="chrono-article" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
