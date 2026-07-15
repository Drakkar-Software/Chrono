import { linkedQuery } from './linked-query';
import { globalSupabaseClient } from '@/lib/supabase';
import { fetchBlogArticles, fetchBlogArticleBySlug } from '@chrono/sdk';
import type { BlogArticle } from '@chrono/sdk';

// The blog is public (read pre-auth via the anon key), so these are plain
// linked queries with no store watch — content changes rarely, so cache long.

export function useBlogArticles() {
  return linkedQuery<BlogArticle[]>(() => fetchBlogArticles(globalSupabaseClient), {
    queryKey: 'blog-articles',
    staleTime: 300_000,
  });
}

export function useBlogArticleBySlug(slug: string | undefined) {
  return linkedQuery<BlogArticle | null>(
    () => fetchBlogArticleBySlug(globalSupabaseClient, slug!),
    {
      enabled: !!slug,
      deps: [slug],
      queryKey: `blog-article:${slug}`,
      staleTime: 300_000,
    },
  );
}
