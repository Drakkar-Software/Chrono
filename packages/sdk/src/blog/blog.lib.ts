import type { BlogArticleContent, LocaleMap } from './blog.entity';

const FALLBACK_LOCALE = 'en';

function pick(map: LocaleMap | undefined, locale: string): string {
  if (!map) return '';
  return map[locale] || map[FALLBACK_LOCALE] || map[Object.keys(map)[0]] || '';
}

export type BlogArticleTranslation = {
  title: string;
  excerpt: string;
  content: string;
};

/** Resolve a blog article's translated fields for a locale (falls back to en). */
export function getBlogArticleTranslation(
  content: BlogArticleContent | null,
  locale: string = FALLBACK_LOCALE,
): BlogArticleTranslation {
  return {
    title: pick(content?.title_translations, locale),
    excerpt: pick(content?.excerpt_translations, locale),
    content: pick(content?.content_translations, locale),
  };
}

/** SEO meta description for a locale: explicit description, else the excerpt. */
export function blogArticleDescription(
  content: BlogArticleContent | null,
  locale: string = FALLBACK_LOCALE,
): string {
  // Locale-exact description (no cross-locale fallback) — a French excerpt reads
  // better as a French meta-description than an English description would.
  const exact = content?.description_translations?.[locale];
  if (exact) return exact;
  return pick(content?.excerpt_translations, locale);
}

/** Rough reading time in minutes from a word count (~200 wpm, min 1). */
export function estimateReadTime(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// ── Minimal, dependency-free Markdown ───────────────────────────────────────
// Supports headings (#/##/###), paragraphs, blockquotes, unordered (-,*) and
// ordered (1.) lists, horizontal rules (---), and inline **bold**, *italic*,
// `code`, and [links](url). Enough for editorial articles; not a full CommonMark
// implementation. All text is HTML-escaped before formatting so article content
// can never inject markup.

export type InlineSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
};

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'hr' };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Only allow safe URL schemes in links (blocks javascript: etc.). */
function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^(https?:|mailto:|\/)/i.test(u)) return u;
  return null;
}

/** Parse a single line of inline markdown into styled segments (for native). */
export function parseInline(line: string): InlineSegment[] {
  const out: InlineSegment[] = [];
  // Order matters: links, then code, then bold, then italic.
  const token =
    /\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/;
  let rest = line;
  let m: RegExpExecArray | null;
  while ((m = token.exec(rest))) {
    if (m.index > 0) out.push({ text: rest.slice(0, m.index) });
    if (m[1] !== undefined) {
      const href = safeHref(m[2]);
      out.push(href ? { text: m[1], href } : { text: m[1] });
    } else if (m[3] !== undefined) {
      out.push({ text: m[3], code: true });
    } else if (m[4] !== undefined) {
      out.push({ text: m[4], bold: true });
    } else if (m[5] !== undefined) {
      out.push({ text: m[5], italic: true });
    }
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) out.push({ text: rest });
  return out.length ? out : [{ text: line }];
}

/** Render one line of inline markdown to safe HTML (for web). */
function inlineToHtml(line: string): string {
  return parseInline(line)
    .map((seg) => {
      const t = escapeHtml(seg.text);
      if (seg.href) return `<a href="${escapeHtml(seg.href)}" rel="noopener">${t}</a>`;
      if (seg.code) return `<code>${t}</code>`;
      if (seg.bold) return `<strong>${t}</strong>`;
      if (seg.italic) return `<em>${t}</em>`;
      return t;
    })
    .join('');
}

/** Parse markdown into block structures (used by the native renderer). */
export function markdownToBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: 'paragraph', text: para.join(' ').trim() });
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: 'list', ordered: list.ordered, items: list.items });
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed === '') {
      flushPara();
      flushList();
      continue;
    }
    if (/^---+$/.test(trimmed)) {
      flushPara();
      flushList();
      blocks.push({ type: 'hr' });
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2] });
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      flushPara();
      flushList();
      blocks.push({ type: 'quote', text: trimmed.replace(/^>\s?/, '') });
      continue;
    }
    const ordered = /^\d+\.\s+(.*)$/.exec(trimmed);
    const unordered = /^[-*]\s+(.*)$/.exec(trimmed);
    if (ordered || unordered) {
      flushPara();
      const isOrdered = !!ordered;
      const item = (ordered ? ordered[1] : unordered![1]);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push(item);
      continue;
    }
    flushList();
    para.push(trimmed);
  }
  flushPara();
  flushList();
  return blocks;
}

/** Render markdown to a safe HTML string (used by the web renderer). */
export function markdownToHtml(markdown: string): string {
  return markdownToBlocks(markdown)
    .map((b) => {
      switch (b.type) {
        case 'heading':
          return `<h${b.level}>${inlineToHtml(b.text)}</h${b.level}>`;
        case 'quote':
          return `<blockquote>${inlineToHtml(b.text)}</blockquote>`;
        case 'hr':
          return '<hr />';
        case 'list': {
          const tag = b.ordered ? 'ol' : 'ul';
          const items = b.items.map((i) => `<li>${inlineToHtml(i)}</li>`).join('');
          return `<${tag}>${items}</${tag}>`;
        }
        case 'paragraph':
        default:
          return `<p>${inlineToHtml(b.text)}</p>`;
      }
    })
    .join('\n');
}
