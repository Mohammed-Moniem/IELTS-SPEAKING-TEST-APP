'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect, useCallback } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import { listFallbackBlogPosts } from '@/lib/seo/blogFallback';
import type { BlogPostSummary } from '@/lib/types';
import { EmptyState, ErrorState, SkeletonSet, StatusBadge } from '@/components/ui/v2';

const POSTS_PER_PAGE = 24;

const ALL_CLUSTERS = [
  'all',
  'speaking',
  'writing',
  'reading',
  'listening',
  'vocabulary',
  'grammar',
  'exam-strategy',
  'pronunciation',
  'academic-skills',
  'ielts-migration',
  'common-mistakes',
  'study-resources'
];

const clusterLabels: Record<string, string> = {
  all: 'All topics',
  speaking: 'Speaking',
  writing: 'Writing',
  reading: 'Reading',
  listening: 'Listening',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  'exam-strategy': 'Exam Strategy',
  pronunciation: 'Pronunciation',
  'academic-skills': 'Academic Skills',
  'ielts-migration': 'Migration & Visas',
  'common-mistakes': 'Common Mistakes',
  'study-resources': 'Study Resources'
};

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

export function BlogIndexPage() {
  const [allPosts, setAllPosts] = useState<BlogPostSummary[]>([]);
  const [cluster, setCluster] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const PAGE_SIZE = 100;
      let offset = 0;
      let accumulated: BlogPostSummary[] = [];
      let hasMore = true;

      while (hasMore) {
        const payload = await webApi.listBlogPosts({ limit: PAGE_SIZE, offset });
        accumulated = [...accumulated, ...payload.posts];
        hasMore = payload.hasMore && payload.posts.length === PAGE_SIZE;
        offset += PAGE_SIZE;
      }

      if (accumulated.length > 0) {
        setAllPosts(accumulated);
        return;
      }
      setAllPosts(listFallbackBlogPosts());
    } catch (err) {
      const fallback = listFallbackBlogPosts();
      if (fallback.length > 0) {
        setAllPosts(fallback);
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to load blog posts');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const filtered = useMemo(() => {
    let result = allPosts;
    if (cluster !== 'all') {
      result = result.filter(p => p.cluster === cluster);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          (p.excerpt && p.excerpt.toLowerCase().includes(q)) ||
          p.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    return result;
  }, [allPosts, cluster, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / POSTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  useEffect(() => {
    setPage(1);
  }, [cluster, search]);

  const handleCluster = (c: string) => {
    setCluster(c);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6" data-testid="marketing-blog-index">
      <section className="marketing-hero-surface rounded-2xl p-8 text-white">
        <span className="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider mb-3">
          Spokio Blog
        </span>
        <h1 className="hero-elegant-title text-3xl font-bold tracking-tight">
          IELTS strategy and study insights
        </h1>
        <p className="hero-elegant-copy mt-2 max-w-2xl text-sm text-white/80">
          500+ practical guides for speaking, writing, reading, listening, vocabulary, grammar, pronunciation, and exam strategy. Every post is tagged by topic so you can jump directly into what matters.
        </p>
      </section>

      {/* Search */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-gray-400">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search articles by title, topic, or keyword…"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>
      </section>

      {/* Cluster filter */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {ALL_CLUSTERS.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => handleCluster(item)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                cluster === item
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {clusterLabels[item] || item}
            </button>
          ))}
        </div>
      </section>

      {/* Results count */}
      {!loading && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Showing {paged.length} of {filtered.length} articles
          {cluster !== 'all' ? ` in ${clusterLabels[cluster] || cluster}` : ''}
          {search.trim() ? ` matching "${search}"` : ''}
        </p>
      )}

      {loading ? <SkeletonSet rows={6} /> : null}

      {!loading && error ? (
        <ErrorState body={error} onRetry={() => void loadPosts()} />
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <EmptyState
          title="No articles found"
          body={
            search.trim()
              ? `No articles match "${search}". Try a different keyword or clear the search.`
              : 'No blog posts in this category yet. Check back shortly.'
          }
        />
      ) : null}

      {!loading && !error && paged.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paged.map(post => (
            <article
              key={post.id}
              className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex rounded-full bg-violet-100 dark:bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                  {clusterLabels[post.cluster] || post.cluster}
                </span>
                <StatusBadge tone={stateTone[post.state]}>
                  {post.state.replace(/_/g, ' ')}
                </StatusBadge>
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
                {post.title}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                {post.excerpt ||
                  'Open the article to read the full guide and action checklist.'}
              </p>
              <div className="flex items-center justify-between gap-3 pt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  Updated {formatDate(post.lastUpdatedAt || post.updatedAt)}
                </span>
                <span>
                  Reviewed {formatDate(post.lastReviewedAt || post.publishedAt)}
                </span>
              </div>
              <div className="pt-2">
                <Link
                  href={`/blog/${post.slug}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
                >
                  Read article
                  <span className="material-symbols-outlined text-[16px]">
                    arrow_forward
                  </span>
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {/* Pagination */}
      {!loading && !error && totalPages > 1 ? (
        <nav
          className="flex items-center justify-center gap-2 pt-4"
          aria-label="Blog pagination"
        >
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => {
              setPage(p => p - 1);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => {
              setPage(p => p + 1);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
