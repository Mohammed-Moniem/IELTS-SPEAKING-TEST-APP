import { blogSlugs } from '@/lib/seo/blogSlugs';
import { ieltsGuides } from '@/lib/seo/ieltsGuides';
import type { BlogContentRisk, BlogPostDetail, BlogPostSummary } from '@/lib/types';

const DEFAULT_SOURCE = 'https://www.ielts.org/';
const SYNTHETIC_FALLBACK_START = Date.UTC(2026, 2, 1, 12, 0, 0);

type GuideEntry = (typeof ieltsGuides)[number];

type FallbackSeed = {
  slug: string;
  title: string;
  cluster: string;
  guide?: GuideEntry;
  index: number;
};

const guideBySlug = new Map(ieltsGuides.map(guide => [guide.slug, guide]));

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

const toSyntheticDate = (index: number) =>
  new Date(SYNTHETIC_FALLBACK_START - index * 24 * 60 * 60 * 1000).toISOString();

const titleCase = (value: string) =>
  value
    .split('-')
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const clusterTopic = (cluster: string) => {
  if (cluster === 'ielts-migration') return 'migration-focused IELTS preparation';
  if (cluster.startsWith('ielts-') && cluster.endsWith('-vocabulary')) {
    return `${titleCase(cluster.replace(/^ielts-/, '').replace(/-vocabulary$/, ''))} vocabulary`;
  }
  return titleCase(cluster).toLowerCase();
};

const buildGuideBody = (guide: GuideEntry) =>
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

const buildSyntheticExcerpt = (seed: FallbackSeed) =>
  `Learn ${seed.title.toLowerCase()} with practical IELTS strategies, common mistakes to avoid, and a focused study checklist for ${clusterTopic(seed.cluster)}.`;

const buildSyntheticTags = (seed: FallbackSeed) => {
  const titleTerms = seed.title
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(term => term.length > 3)
    .slice(0, 4);

  return Array.from(
    new Set([
      'ielts',
      seed.cluster,
      ...seed.cluster.split('-').filter(part => part !== 'ielts'),
      ...titleTerms
    ])
  );
};

const buildSyntheticBody = (seed: FallbackSeed) =>
  [
    `# ${seed.title}`,
    '',
    buildSyntheticExcerpt(seed),
    '',
    '## Why this matters',
    `Strong ${clusterTopic(seed.cluster)} performance depends on using a repeatable process instead of relying on luck or memorized phrases.`,
    '',
    '## What to focus on',
    `- Identify the scoring criteria that matter most for ${seed.title.toLowerCase()}.`,
    '- Practise with timed responses so your technique still works under pressure.',
    '- Review model answers and compare them against your own structure and vocabulary choices.',
    '',
    '## Practice routine',
    '1. Start with one realistic timed attempt and note the sections that feel unstable.',
    '2. Rewrite or re-answer using clearer structure, more precise language, and stronger examples.',
    '3. Repeat the drill until you can deliver the same quality within the real exam time limit.',
    '',
    '## Common mistakes',
    '- Using generic ideas instead of specific support.',
    '- Losing control of timing while trying to sound advanced.',
    '- Ignoring feedback patterns that keep lowering band score consistency.',
    '',
    '## Next step',
    'Open Spokio, complete one focused practice session, and turn the feedback into your next study action.'
  ].join('\n');

const buildGuideSummary = (guide: GuideEntry, index: number): BlogPostSummary => {
  const publishedAt = guide.lastUpdated || guide.lastReviewed || toSyntheticDate(index);

  return {
    id: `fallback-blog-${guide.slug}`,
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
    lastReviewedAt: guide.lastReviewed || publishedAt,
    lastUpdatedAt: guide.lastUpdated || guide.lastReviewed || publishedAt,
    createdAt: guide.lastReviewed || publishedAt,
    updatedAt: guide.lastUpdated || guide.lastReviewed || publishedAt
  };
};

const buildSyntheticSummary = (seed: FallbackSeed): BlogPostSummary => {
  const publishedAt = toSyntheticDate(seed.index);

  return {
    id: `fallback-blog-${seed.slug}`,
    title: seed.title,
    slug: seed.slug,
    excerpt: buildSyntheticExcerpt(seed),
    cluster: seed.cluster,
    tags: buildSyntheticTags(seed),
    state: 'published',
    contentRisk: 'low_risk_update',
    qaPassed: true,
    qaScore: 78,
    publishedAt,
    lastReviewedAt: publishedAt,
    lastUpdatedAt: publishedAt,
    createdAt: publishedAt,
    updatedAt: publishedAt
  };
};

const fallbackSeeds: FallbackSeed[] = [];
const seenSlugs = new Set<string>();

blogSlugs.forEach((entry, index) => {
  seenSlugs.add(entry.slug);
  fallbackSeeds.push({
    slug: entry.slug,
    title: entry.title,
    cluster: toCluster(entry.cluster),
    guide: guideBySlug.get(entry.slug),
    index
  });
});

ieltsGuides.forEach((guide, index) => {
  if (seenSlugs.has(guide.slug)) return;
  fallbackSeeds.push({
    slug: guide.slug,
    title: guide.title,
    cluster: toCluster(guide.cluster),
    guide,
    index: blogSlugs.length + index
  });
});

const fallbackSeedBySlug = new Map(fallbackSeeds.map(seed => [seed.slug, seed]));

const fallbackBlogPosts: BlogPostSummary[] = fallbackSeeds.map(seed =>
  seed.guide ? buildGuideSummary(seed.guide, seed.index) : buildSyntheticSummary(seed)
);

export const listFallbackBlogPosts = (): BlogPostSummary[] => fallbackBlogPosts;

export const getFallbackBlogPostBySlug = (slug: string): BlogPostDetail | null => {
  const seed = fallbackSeedBySlug.get(slug);
  if (!seed) return null;

  if (seed.guide) {
    const summary = buildGuideSummary(seed.guide, seed.index);
    const sourceLinks = seed.guide.answerBlock?.sourceBullets.map(item => item.sourceUrl) || [DEFAULT_SOURCE];

    return {
      ...summary,
      body: buildGuideBody(seed.guide),
      sourceLinks
    };
  }

  const summary = buildSyntheticSummary(seed);

  return {
    ...summary,
    body: buildSyntheticBody(seed),
    sourceLinks: [DEFAULT_SOURCE]
  };
};
