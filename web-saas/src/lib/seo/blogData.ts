import { getFallbackBlogPostBySlug, listFallbackBlogPosts } from '@/lib/seo/blogFallback';
import type { BlogPostDetail, BlogPostListResponse, BlogPostSummary } from '@/lib/types';

type FetchJsonResult<T> = {
  ok: boolean;
  data: T | null;
};

const BLOG_API_TIMEOUT_MS = 3000;
const BLOG_INDEX_PAGE_SIZE = 500;
const BLOG_FETCH_REVALIDATE_SECONDS = 900;
const BLOG_DETAIL_REVALIDATE_SECONDS = 1800;
const BLOG_INDEX_MAX_POSTS = 2500;
const BLOG_LOOPBACK_PROBE_TIMEOUT_MS = 250;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const loopbackBaseReachability = new Map<string, Promise<boolean>>();

function isLoopbackApiBase(baseUrl: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(baseUrl).hostname);
  } catch {
    return false;
  }
}

async function isReachableLoopbackBase(baseUrl: string): Promise<boolean> {
  if (!isLoopbackApiBase(baseUrl)) {
    return true;
  }

  const cached = loopbackBaseReachability.get(baseUrl);
  if (cached) {
    return cached;
  }

  const probe = (async () => {
    const controller = new AbortController();

    const timeout = setTimeout(() => controller.abort(), BLOG_LOOPBACK_PROBE_TIMEOUT_MS);

    try {
      await fetch(baseUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      });
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  })();

  loopbackBaseReachability.set(baseUrl, probe);
  return probe;
}

function resolveAbsoluteApiBase(): string | null {
  const rawBase = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || '').trim();

  if (!rawBase) {
    return null;
  }

  if (/^https?:\/\//i.test(rawBase)) {
    return rawBase.replace(/\/$/, '');
  }

  if (!rawBase.startsWith('/')) {
    return null;
  }

  const internalBase = (process.env.API_INTERNAL_BASE_URL || '').trim();
  if (internalBase && /^https?:\/\//i.test(internalBase)) {
    return `${internalBase.replace(/\/$/, '')}${rawBase}`.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV !== 'production') {
    return `http://127.0.0.1:4000${rawBase}`.replace(/\/$/, '');
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || '').trim();
  if (siteUrl && /^https?:\/\//i.test(siteUrl)) {
    return `${siteUrl.replace(/\/$/, '')}${rawBase}`.replace(/\/$/, '');
  }

  const vercelUrl = (process.env.VERCEL_URL || '').trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, '')}${rawBase}`.replace(/\/$/, '');
  }

  return null;
}

function sortBlogPosts(posts: BlogPostSummary[]): BlogPostSummary[] {
  return [...posts].sort((left, right) => {
    const leftDate = Date.parse(left.lastUpdatedAt || left.publishedAt || left.updatedAt || '') || 0;
    const rightDate = Date.parse(right.lastUpdatedAt || right.publishedAt || right.updatedAt || '') || 0;
    return rightDate - leftDate;
  });
}

function normalizeSummary(post: BlogPostSummary): BlogPostSummary {
  return {
    ...post,
    tags: Array.isArray(post.tags) ? post.tags : [],
    state: post.state || 'published'
  };
}

function normalizeDetail(post: BlogPostDetail): BlogPostDetail {
  return {
    ...normalizeSummary(post),
    body: post.body || '',
    sourceLinks: Array.isArray(post.sourceLinks) ? post.sourceLinks.filter(Boolean) : []
  };
}

async function fetchBlogJson<T>(path: string, revalidateSeconds: number): Promise<FetchJsonResult<T>> {
  const baseUrl = resolveAbsoluteApiBase();
  if (!baseUrl) {
    return {
      ok: false,
      data: null
    };
  }

  if (!(await isReachableLoopbackBase(baseUrl))) {
    return {
      ok: false,
      data: null
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BLOG_API_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      cache: 'force-cache',
      next: { revalidate: revalidateSeconds },
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      return {
        ok: false,
        data: null
      };
    }

    const payload = (await response.json()) as {
      success?: boolean;
      data?: T;
    };

    if (!payload?.success || !payload.data) {
      return {
        ok: false,
        data: null
      };
    }

    return {
      ok: true,
      data: payload.data
    };
  } catch {
    return {
      ok: false,
      data: null
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function listPublicBlogPostsPage(params: {
  cluster?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<BlogPostListResponse | null> {
  const query = new URLSearchParams();

  if (params.cluster) query.set('cluster', params.cluster);
  if (params.search) query.set('search', params.search);
  if (typeof params.limit === 'number') query.set('limit', String(params.limit));
  if (typeof params.offset === 'number') query.set('offset', String(params.offset));

  const response = await fetchBlogJson<BlogPostListResponse>(
    `/blog/posts${query.toString() ? `?${query.toString()}` : ''}`,
    BLOG_FETCH_REVALIDATE_SECONDS
  );

  if (!response.ok || !response.data) {
    return null;
  }

  return {
    ...response.data,
    posts: response.data.posts.map(normalizeSummary)
  };
}

export async function listPublishedBlogPosts(): Promise<BlogPostSummary[]> {
  const postsBySlug = new Map<string, BlogPostSummary>();
  let offset = 0;
  let hasMore = true;
  let loadedAnyPage = false;

  while (hasMore && offset < BLOG_INDEX_MAX_POSTS) {
    const page = await listPublicBlogPostsPage({
      limit: BLOG_INDEX_PAGE_SIZE,
      offset
    });

    if (!page) {
      break;
    }

    loadedAnyPage = true;

    page.posts
      .filter(post => post.state === 'published' || !post.state)
      .forEach(post => {
        postsBySlug.set(post.slug, post);
      });

    hasMore = Boolean(page.hasMore);
    offset += page.limit || BLOG_INDEX_PAGE_SIZE;
  }

  if (postsBySlug.size > 0) {
    return sortBlogPosts(Array.from(postsBySlug.values()));
  }

  if (loadedAnyPage) {
    return [];
  }

  return listFallbackBlogPosts();
}

export async function getPublicBlogPost(slug: string): Promise<BlogPostDetail | null> {
  const response = await fetchBlogJson<BlogPostDetail>(
    `/blog/posts/${slug}`,
    BLOG_DETAIL_REVALIDATE_SECONDS
  );

  if (response.ok && response.data) {
    return normalizeDetail(response.data);
  }

  return getFallbackBlogPostBySlug(slug);
}
