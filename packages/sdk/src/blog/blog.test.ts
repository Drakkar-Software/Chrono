import { describe, it, expect } from 'vitest';
import {
  getBlogArticleTranslation,
  blogArticleDescription,
  estimateReadTime,
  parseInline,
  markdownToBlocks,
  markdownToHtml,
} from './blog.lib';
import type { BlogArticleContent } from './blog.entity';

const content: BlogArticleContent = {
  title_translations: { en: 'Hello', fr: 'Bonjour' },
  excerpt_translations: { en: 'Ex', fr: 'Extrait' },
  content_translations: { en: '# Hi', fr: '# Salut' },
  description_translations: { en: 'Desc' },
};

describe('getBlogArticleTranslation', () => {
  it('picks the requested locale', () => {
    expect(getBlogArticleTranslation(content, 'fr').title).toBe('Bonjour');
  });
  it('falls back to en when locale missing', () => {
    expect(getBlogArticleTranslation(content, 'de').title).toBe('Hello');
  });
  it('is safe on null content', () => {
    expect(getBlogArticleTranslation(null, 'fr')).toEqual({ title: '', excerpt: '', content: '' });
  });
});

describe('blogArticleDescription', () => {
  it('prefers an explicit description', () => {
    expect(blogArticleDescription(content, 'en')).toBe('Desc');
  });
  it('falls back to the excerpt when no description for the locale', () => {
    expect(blogArticleDescription(content, 'fr')).toBe('Extrait');
  });
});

describe('estimateReadTime', () => {
  it('is at least 1 minute', () => {
    expect(estimateReadTime('one two three')).toBe(1);
  });
  it('scales ~200 wpm', () => {
    expect(estimateReadTime(Array(400).fill('w').join(' '))).toBe(2);
  });
});

describe('parseInline', () => {
  it('splits bold / italic / code / links', () => {
    const segs = parseInline('a **b** c *d* `e` [f](https://x.io)');
    expect(segs.find((s) => s.bold)?.text).toBe('b');
    expect(segs.find((s) => s.italic)?.text).toBe('d');
    expect(segs.find((s) => s.code)?.text).toBe('e');
    expect(segs.find((s) => s.href)?.href).toBe('https://x.io');
  });
  it('drops unsafe link schemes (keeps text)', () => {
    const segs = parseInline('[x](javascript:alert(1))');
    expect(segs[0].href).toBeUndefined();
    expect(segs[0].text).toBe('x');
  });
});

describe('markdownToBlocks', () => {
  it('parses headings, lists, quote, hr, paragraphs', () => {
    const blocks = markdownToBlocks('# H1\n\npara one\n\n- a\n- b\n\n> quote\n\n---');
    expect(blocks[0]).toEqual({ type: 'heading', level: 1, text: 'H1' });
    expect(blocks[1]).toEqual({ type: 'paragraph', text: 'para one' });
    expect(blocks[2]).toEqual({ type: 'list', ordered: false, items: ['a', 'b'] });
    expect(blocks[3]).toEqual({ type: 'quote', text: 'quote' });
    expect(blocks[4]).toEqual({ type: 'hr' });
  });
  it('groups an ordered list', () => {
    const blocks = markdownToBlocks('1. one\n2. two');
    expect(blocks[0]).toEqual({ type: 'list', ordered: true, items: ['one', 'two'] });
  });
});

describe('markdownToHtml', () => {
  it('emits semantic tags', () => {
    const html = markdownToHtml('# Title\n\nHello **world**');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>world</strong>');
  });
  it('escapes HTML in text (no injection)', () => {
    const html = markdownToHtml('a <script>x</script> b');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('renders safe links with rel=noopener and drops unsafe ones', () => {
    expect(markdownToHtml('[ok](https://x.io)')).toContain('<a href="https://x.io" rel="noopener">ok</a>');
    expect(markdownToHtml('[bad](javascript:alert(1))')).not.toContain('href="javascript');
  });
});
