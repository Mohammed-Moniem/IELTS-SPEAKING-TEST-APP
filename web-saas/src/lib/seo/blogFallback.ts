import { ieltsGuides } from '@/lib/seo/ieltsGuides';
import type { BlogContentRisk, BlogPostDetail, BlogPostSummary } from '@/lib/types';

const DEFAULT_SOURCE = 'https://www.ielts.org/';

const toCluster = (cluster?: string): string => {
  if (!cluster) return 'exam-strategy';
  if (cluster === 'vocabulary-collocations') return 'vocabulary';
  if (cluster === 'institutions-coaches') return 'exam-strategy';
  return cluster;
};

const toContentRisk = (intent: string): BlogContentRisk => {
  if (intent === 'commercial') return 'commercial';
  if (intent === 'transactional') return 'pillar';
  return 'low_risk_update';
};

const buildBody = (guide: (typeof ieltsGuides)[number]) =>
  [
    `# ${guide.h1}`,
    '',
    guide.overview,
    '',
    '## Key Takeaways',
    ...guide.keyPoints.map(item => `- ${item}`),
    '',
    '## Practical Action Plan',
    ...guide.actionPlan.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Recommended Plan',
    `Use the ${guide.recommendedPlan} plan when you need higher-volume drills and faster scoring feedback.`,
    '',
    '## Next Step',
    'Create your account, run one timed drill immediately, and log your next action before ending the session.'
  ].join('\n');

const fallbackBlogPosts: BlogPostDetail[] = ieltsGuides.slice(0, 24).map((guide, index) => {
  const publishedAt = guide.lastUpdated || guide.lastReviewed;
  const sourceLinks = guide.answerBlock?.sourceBullets.map(item => item.sourceUrl) || [DEFAULT_SOURCE];

  return {
    id: `fallback-blog-${index + 1}`,
    title: guide.title,
    slug: guide.slug,
    excerpt: guide.description,
    cluster: toCluster(guide.cluster),
    tags: ['ielts', toCluster(guide.cluster), guide.recommendedPlan.toLowerCase()],
    state: 'published',
    contentRisk: toContentRisk(guide.intent),
    qaPassed: true,
    qaScore: 82,
    publishedAt,
    lastReviewedAt: guide.lastReviewed,
    lastUpdatedAt: guide.lastUpdated || guide.lastReviewed,
    createdAt: guide.lastReviewed,
    updatedAt: guide.lastUpdated || guide.lastReviewed,
    body: buildBody(guide),
    sourceLinks
  };
});

export const listFallbackBlogPosts = (): BlogPostSummary[] => fallbackBlogPosts;

export const getFallbackBlogPostBySlug = (slug: string): BlogPostDetail | null =>
  fallbackBlogPosts.find(post => post.slug === slug) || null;
