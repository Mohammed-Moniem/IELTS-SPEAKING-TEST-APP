'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';

import { MarketingGraphicLayer } from '@/components/marketing/MarketingGraphicLayer';
import { MarketingPageHero } from '@/components/marketing/MarketingPageHero';
import { ApiError, webApi } from '@/lib/api/client';
import type { BlogPostSummary } from '@/lib/types';
import { EmptyState, ErrorState, SkeletonSet, StatusBadge } from '@/components/ui/v2';

const stateTone: Record<BlogPostSummary['state'], 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'> = {
  idea: 'info',
  outline: 'info',
  draft: 'warning',
  qa_passed: 'success',
  pending_review: 'warning',
  published: 'success',
  archived: 'neutral'
};

const formatDate = (value?: string) => {
  if (!value) return 'Pending publish';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

type BlogIndexPageProps = {
  isMotionVariant?: boolean;
};

export function BlogIndexPage({ isMotionVariant = false }: BlogIndexPageProps) {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [cluster, setCluster] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPosts = async (targetCluster: string) => {
    setLoading(true);
    setError('');
    try {
      const payload = await webApi.listBlogPosts({
        cluster: targetCluster === 'all' ? undefined : targetCluster,
        limit: 40,
        offset: 0
      });
      setPosts(payload.posts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPosts(cluster);
  }, [cluster]);

  const clusters = useMemo(() => {
    const unique = Array.from(new Set(posts.map(post => post.cluster).filter(Boolean)));
    return ['all', ...unique];
  }, [posts]);

  return (
    <div className="space-y-6" data-testid="marketing-blog-index">
      {isMotionVariant ? (
        <MarketingPageHero
          variant="full"
          animated
          badge={{ icon: 'article', text: 'Spokio Blog' }}
          title="IELTS strategy and study insights"
          description="Practical, reviewed content for speaking, writing, reading, listening, and exam strategy. Every post is tagged by cluster so you can jump directly into the topic that matters."
        />
      ) : (
        <section className="rounded-2xl border border-violet-100 dark:border-violet-900/40 bg-gradient-to-r from-violet-600 to-indigo-600 p-8 text-white">
          <span className="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider mb-3">
            Spokio Blog
          </span>
          <h1 className="text-3xl font-bold tracking-tight">IELTS strategy and study insights</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/80">
            Practical, reviewed content for speaking, writing, reading, listening, and exam strategy. Every post is tagged by cluster so you can jump directly into the topic that matters.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {clusters.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setCluster(item)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                cluster === item
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {item === 'all' ? 'All clusters' : item}
            </button>
          ))}
        </div>
      </section>

      {loading ? <SkeletonSet rows={6} /> : null}

      {!loading && error ? <ErrorState body={error} onRetry={() => void loadPosts(cluster)} /> : null}

      {!loading && !error && posts.length === 0 ? (
        <EmptyState title="No blog posts yet" body="New posts are generated and reviewed continuously. Check back shortly." />
      ) : null}

      {!loading && !error && posts.length > 0 ? (
        <section className={`relative isolate overflow-hidden rounded-3xl ${isMotionVariant ? 'p-5 sm:p-6' : ''}`}>
          {isMotionVariant ? <MarketingGraphicLayer preset="content-highlight" intensity="subtle" /> : null}
          <div className="relative z-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {posts.map(post => (
              <article key={post.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex rounded-full bg-violet-100 dark:bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                    {post.cluster}
                  </span>
                  <StatusBadge tone={stateTone[post.state]}>{post.state.replace(/_/g, ' ')}</StatusBadge>
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">{post.title}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{post.excerpt || 'Open the article to read the full guide and action checklist.'}</p>
                <div className="flex items-center justify-between gap-3 pt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Updated {formatDate(post.lastUpdatedAt || post.updatedAt)}</span>
                  <span>Reviewed {formatDate(post.lastReviewedAt || post.publishedAt)}</span>
                </div>
                <div className="pt-2">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
                  >
                    Read article
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
