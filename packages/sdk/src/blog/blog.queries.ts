import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../schema';
import type { BlogArticle } from './blog.entity';

type Client = SupabaseClient<Database>;

export const BLOG_SELECT =
  'id, slug, content, author, image_url, read_time, keywords, published_at, created_at, updated_at' as const;

/** All published articles, newest first. RLS already hides drafts/deleted. */
export async function fetchBlogArticles(client: Client): Promise<BlogArticle[]> {
  const { data, error } = await client
    .from('blog_articles')
    .select(BLOG_SELECT)
    .eq('status', 'published')
    .eq('deleted', false)
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BlogArticle[];
}

/** A single published article by slug, or null. */
export async function fetchBlogArticleBySlug(
  client: Client,
  slug: string,
): Promise<BlogArticle | null> {
  const { data, error } = await client
    .from('blog_articles')
    .select(BLOG_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('deleted', false)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as BlogArticle | null;
}
