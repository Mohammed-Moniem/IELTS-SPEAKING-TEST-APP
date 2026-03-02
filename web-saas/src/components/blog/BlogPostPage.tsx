'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import type { BlogPostDetail } from '@/lib/types';
import { EmptyState, ErrorState, SkeletonSet } from '@/components/ui/v2';

type Props = {
  slug: string;
};

const formatDate = (value?: string) => {
  if (!value) return '--';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const toHtml = (markdown: string) => {
  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<h\d|<p|<ul|<ol|<li|<blockquote)(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
};

export function BlogPostPage({ slug }: Props) {
  const [post, setPost] = useState<BlogPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPost = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await webApi.getBlogPost(slug);
      setPost(payload);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load blog post');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPost();
  }, [slug]);

  const articleHtml = useMemo(() => (post ? toHtml(post.body || '') : ''), [post]);

  const schema = useMemo(() => {
    if (!post) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      datePublished: post.publishedAt,
      dateModified: post.lastUpdatedAt || post.updatedAt,
      articleSection: post.cluster,
      keywords: post.tags,
      description: post.excerpt,
      mainEntityOfPage: `/blog/${post.slug}`
    };
  }, [post]);

  return (
    <div className="space-y-6" data-testid="marketing-blog-post">
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to blog
      </Link>

      {loading ? <SkeletonSet rows={8} /> : null}

      {!loading && error ? <ErrorState body={error} onRetry={() => void loadPost()} /> : null}

      {!loading && !error && !post ? <EmptyState title="Article not found" body="This article may have been moved or unpublished." /> : null}

      {!loading && !error && post ? (
        <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 lg:p-8 space-y-6">
          {schema ? (
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
          ) : null}
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="rounded-full bg-violet-100 dark:bg-violet-500/10 px-2.5 py-0.5 font-semibold text-violet-700 dark:text-violet-300">
                {post.cluster}
              </span>
              <span>Published {formatDate(post.publishedAt)}</span>
              <span>Last reviewed {formatDate(post.lastReviewedAt)}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{post.title}</h1>
            {post.excerpt ? <p className="text-base text-gray-600 dark:text-gray-300 max-w-3xl">{post.excerpt}</p> : null}
            {post.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {post.tags.map(tag => (
                  <span key={tag} className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </header>

          <div
            className="prose prose-gray dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-violet-600 dark:prose-a:text-violet-400"
            dangerouslySetInnerHTML={{ __html: articleHtml }}
          />

          <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-4 space-y-3">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Use this strategy in Spokio</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Apply this article immediately inside the learner workspace using module practice flows and full exam simulation.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/app/dashboard" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
                Open Learner App
              </Link>
              <Link href="/pricing" className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                View plans
              </Link>
            </div>
          </section>
        </article>
      ) : null}
    </div>
  );
}
