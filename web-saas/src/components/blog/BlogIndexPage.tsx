'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { BlogPostSummary } from '@/lib/types';
import { EmptyState, StatusBadge } from '@/components/ui/v2';

const POSTS_PER_PAGE = 10;

const clusterLabelOverrides: Record<string, string> = {
  'academic-skills': 'Academic Skills',
  'common-mistakes': 'Common Mistakes',
  'exam-strategy': 'Exam Strategy',
  'ielts-listening-vocabulary': 'Listening Vocabulary',
  'ielts-migration': 'Migration & Visas',
  'ielts-reading-vocabulary': 'Reading Vocabulary',
  'ielts-speaking-vocabulary': 'Speaking Vocabulary',
  'ielts-writing-vocabulary': 'Writing Vocabulary',
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

const formatClusterLabel = (value: string) => {
  if (clusterLabelOverrides[value]) {
    return clusterLabelOverrides[value];
  }

  return value
    .replace(/^ielts-/, '')
    .split('-')
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

type Props = {
  posts: BlogPostSummary[];
};

export function BlogIndexPage({ posts }: Props) {
  const [cluster, setCluster] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  const availableClusters = [
    'all',
    ...Array.from(new Set(posts.map(post => post.cluster))).sort((left, right) =>
      formatClusterLabel(left).localeCompare(formatClusterLabel(right))
    )
  ];

  const search = searchInput.trim().toLowerCase();
  const filteredPosts = posts.filter(post => {
    if (cluster !== 'all' && post.cluster !== cluster) {
      return false;
    }

    if (!search) {
      return true;
    }

    const searchableText = [post.title, post.excerpt || '', ...post.tags].join(' ').toLowerCase();
    return searchableText.includes(search);
  });

  const total = filteredPosts.length;
  const totalPages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * POSTS_PER_PAGE;
  const paginatedPosts = filteredPosts.slice(offset, offset + POSTS_PER_PAGE);

  const showEmpty = paginatedPosts.length === 0;

  const handleCluster = (nextCluster: string) => {
    setCluster(nextCluster);
    setPage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
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

      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-gray-400">
            search
          </span>
          <input
            type="text"
            value={searchInput}
            onChange={event => {
              setSearchInput(event.target.value);
              setPage(1);
            }}
            placeholder="Search articles by title, topic, or keyword…"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {availableClusters.map(item => (
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
              {item === 'all' ? 'All topics' : formatClusterLabel(item)}
            </button>
          ))}
        </div>
      </section>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing {paginatedPosts.length} of {total} articles
        {cluster !== 'all' ? ` in ${formatClusterLabel(cluster)}` : ''}
        {search ? ` matching "${searchInput.trim()}"` : ''}
      </p>

      {showEmpty ? (
        <EmptyState
          title={posts.length === 0 ? 'No articles available yet' : 'No articles found'}
          body={
            search
              ? `No articles match "${searchInput.trim()}". Try a different keyword or clear the search.`
              : 'No blog posts match this topic yet. Check back shortly.'
          }
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paginatedPosts.map(post => (
            <article
              key={post.id}
              data-testid="marketing-blog-card"
              className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex rounded-full bg-violet-100 dark:bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                  {formatClusterLabel(post.cluster)}
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
      )}

      {totalPages > 1 ? (
        <nav
          className="flex items-center justify-center gap-2 pt-4"
          aria-label="Blog pagination"
        >
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
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
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
