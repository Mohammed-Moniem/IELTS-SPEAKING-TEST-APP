'use client';

import { useEffect, useMemo, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import type { BlogPostState, BlogPostSummary, SeoContentHealth } from '@/lib/types';
import { EmptyState, ErrorState, SkeletonSet, StatusBadge } from '@/components/ui/v2';

const stateTone: Record<BlogPostState, 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'> = {
  idea: 'info',
  outline: 'info',
  draft: 'warning',
  qa_passed: 'success',
  pending_review: 'warning',
  published: 'success',
  archived: 'neutral'
};

const formatDate = (value?: string) => {
  if (!value) return '--';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export function AdminBlogManagerPage() {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [cluster, setCluster] = useState('all');
  const [state, setState] = useState<'all' | BlogPostState>('all');

  const [ideaCluster, setIdeaCluster] = useState('');
  const [ideaCount, setIdeaCount] = useState(5);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftCluster, setDraftCluster] = useState('');
  const [draftRisk, setDraftRisk] = useState<'low_risk_update' | 'pillar' | 'commercial'>('low_risk_update');
  const [draftBody, setDraftBody] = useState(
    '# Strategy Brief\n\n- Start with a direct answer block.\n- Provide source-attributed evidence.\n- Add when-to-use guidance.\n\nSources: https://www.ielts.org/'
  );
  const [draftAutoPublish, setDraftAutoPublish] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [busyPostId, setBusyPostId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [seoHealth, setSeoHealth] = useState<SeoContentHealth | null>(null);
  const [seoCluster, setSeoCluster] = useState('');
  const [seoLimit, setSeoLimit] = useState(30);

  const loadPosts = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await webApi.listAdminBlogPosts({
        cluster: cluster === 'all' ? undefined : cluster,
        state: state === 'all' ? undefined : state,
        limit: 50,
        offset: 0
      });
      setPosts(payload.posts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  const loadSeoHealth = async () => {
    try {
      const payload = await webApi.getSeoContentHealth();
      setSeoHealth(payload);
    } catch {
      // Keep blog workflow usable even if SEO health fails.
    }
  };

  useEffect(() => {
    void loadPosts();
    void loadSeoHealth();
    // Filtering intentionally triggers fresh load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cluster, state]);

  const clusters = useMemo(() => ['all', ...Array.from(new Set(posts.map(post => post.cluster).filter(Boolean)))], [posts]);

  const generateIdeas = async () => {
    setSubmitting(true);
    setNotice('');
    setError('');
    try {
      const payload = await webApi.generateBlogIdeas({
        cluster: ideaCluster || undefined,
        count: ideaCount
      });
      setNotice(`Idea job ${payload.jobId} created ${payload.ideas.length} idea posts.`);
      await loadPosts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate ideas');
    } finally {
      setSubmitting(false);
    }
  };

  const createDraft = async () => {
    if (!draftTitle.trim()) {
      setError('Draft title is required.');
      return;
    }

    setSubmitting(true);
    setNotice('');
    setError('');
    try {
      const payload = await webApi.createBlogDraft({
        title: draftTitle.trim(),
        cluster: draftCluster || undefined,
        contentRisk: draftRisk,
        body: draftBody.trim(),
        scheduleAutoPublish: draftAutoPublish
      });
      setNotice(`Draft created in state ${payload.post.state}.`);
      setDraftTitle('');
      await loadPosts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create draft');
    } finally {
      setSubmitting(false);
    }
  };

  const reviewPost = async (postId: string, decision: 'approved' | 'rejected' | 'changes_requested') => {
    setBusyPostId(postId);
    setNotice('');
    setError('');
    try {
      await webApi.reviewBlogPost(postId, {
        decision,
        notes: reviewNotes[postId]?.trim() || undefined
      });
      setNotice(`Review decision "${decision}" recorded.`);
      await loadPosts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to review post');
    } finally {
      setBusyPostId('');
    }
  };

  const publishPost = async (postId: string) => {
    setBusyPostId(postId);
    setNotice('');
    setError('');
    try {
      await webApi.publishBlogPost(postId);
      setNotice('Post published successfully.');
      await loadPosts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to publish post');
    } finally {
      setBusyPostId('');
    }
  };

  const queueSeoRefresh = async () => {
    setSubmitting(true);
    setNotice('');
    setError('');
    try {
      const payload = await webApi.enqueueSeoRefreshQueue({
        cluster: seoCluster.trim() || undefined,
        limit: seoLimit
      });
      setNotice(`Queued ${payload.queued} refresh jobs (${payload.skipped} skipped duplicates).`);
      await Promise.all([loadPosts(), loadSeoHealth()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to enqueue SEO refresh queue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
        <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
          Hybrid governance
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Blog Content Operations</h1>
        <p className="mt-1 text-sm text-white/85">
          Manage the pipeline from idea → outline → draft → qa_passed → pending_review → published.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Generate ideas</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
              value={ideaCluster}
              onChange={event => setIdeaCluster(event.target.value)}
              placeholder="Cluster (optional)"
            />
            <input
              type="number"
              min={1}
              max={50}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
              value={ideaCount}
              onChange={event => setIdeaCount(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
            />
          </div>
          <button
            type="button"
            onClick={() => void generateIdeas()}
            disabled={submitting}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {submitting ? 'Generating...' : 'Generate Ideas'}
          </button>
        </article>

        <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Create draft</h2>
          <input
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
            value={draftTitle}
            onChange={event => setDraftTitle(event.target.value)}
            placeholder="Post title"
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
              value={draftCluster}
              onChange={event => setDraftCluster(event.target.value)}
              placeholder="Cluster"
            />
            <select
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
              value={draftRisk}
              onChange={event => setDraftRisk(event.target.value as 'low_risk_update' | 'pillar' | 'commercial')}
            >
              <option value="low_risk_update">low_risk_update</option>
              <option value="pillar">pillar</option>
              <option value="commercial">commercial</option>
            </select>
          </div>
          <textarea
            className="min-h-[140px] w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
            value={draftBody}
            onChange={event => setDraftBody(event.target.value)}
            placeholder="Markdown draft body..."
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={draftAutoPublish}
              onChange={event => setDraftAutoPublish(event.target.checked)}
              className="h-4 w-4 accent-violet-600"
            />
            Auto-publish if low-risk and QA passes
          </label>
          <button
            type="button"
            onClick={() => void createDraft()}
            disabled={submitting}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Create Draft'}
          </button>
        </article>
      </section>

      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">SEO Content Health</h2>
          <button
            type="button"
            onClick={() => void loadSeoHealth()}
            className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300"
          >
            Refresh Health
          </button>
        </div>
        {seoHealth ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <article className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-3">
              <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Published</p>
              <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{seoHealth.totals.publishedPosts}</p>
            </article>
            <article className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-3">
              <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Pending review</p>
              <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{seoHealth.totals.pendingReviewPosts}</p>
            </article>
            <article className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-3">
              <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Schema failures</p>
              <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{seoHealth.totals.schemaFailures}</p>
            </article>
            <article className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-3">
              <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Queued jobs</p>
              <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{seoHealth.totals.queuedJobs}</p>
            </article>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">SEO health data unavailable for this environment.</p>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px_auto]">
          <input
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
            placeholder="Cluster key (optional)"
            value={seoCluster}
            onChange={event => setSeoCluster(event.target.value)}
          />
          <input
            type="number"
            min={1}
            max={500}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
            value={seoLimit}
            onChange={event => setSeoLimit(Math.max(1, Math.min(500, Number(event.target.value) || 1)))}
          />
          <button
            type="button"
            onClick={() => void queueSeoRefresh()}
            disabled={submitting}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            Queue SEO Refresh
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
            value={cluster}
            onChange={event => setCluster(event.target.value)}
          >
            {clusters.map(item => (
              <option key={item} value={item}>
                {item === 'all' ? 'All clusters' : item}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
            value={state}
            onChange={event => setState(event.target.value as 'all' | BlogPostState)}
          >
            {['all', 'idea', 'outline', 'draft', 'qa_passed', 'pending_review', 'published', 'archived'].map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadPosts()}
            className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300"
          >
            Refresh
          </button>
        </div>
        {notice ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p> : null}
        {error ? <ErrorState body={error} onRetry={() => void loadPosts()} /> : null}
      </section>

      {loading ? <SkeletonSet rows={6} /> : null}

      {!loading && !error && posts.length === 0 ? (
        <EmptyState title="No posts in this filter" body="Generate ideas or create a draft to begin the workflow." />
      ) : null}

      {!loading && !error && posts.length > 0 ? (
        <section className="space-y-3">
          {posts.map(post => {
            const publishAllowed = post.qaPassed && post.state !== 'published';
            return (
              <article key={post.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{post.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {post.cluster} • Updated {formatDate(post.lastUpdatedAt || post.updatedAt)} • Reviewed{' '}
                      {formatDate(post.lastReviewedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={stateTone[post.state]}>{post.state}</StatusBadge>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        post.qaPassed
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                      }`}
                    >
                      QA {post.qaPassed ? 'passed' : 'pending'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{post.excerpt || 'No excerpt available.'}</p>
                <textarea
                  className="min-h-[80px] w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  value={reviewNotes[post.id] || ''}
                  onChange={event => setReviewNotes(prev => ({ ...prev, [post.id]: event.target.value }))}
                  placeholder="Review notes (optional)"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void reviewPost(post.id, 'approved')}
                    disabled={busyPostId === post.id}
                    className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void reviewPost(post.id, 'changes_requested')}
                    disabled={busyPostId === post.id}
                    className="rounded-xl border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-700 dark:border-amber-500/40 dark:text-amber-300"
                  >
                    Request Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => void reviewPost(post.id, 'rejected')}
                    disabled={busyPostId === post.id}
                    className="rounded-xl border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-500/40 dark:text-red-300"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => void publishPost(post.id)}
                    disabled={busyPostId === post.id || !publishAllowed}
                    className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    Publish
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
