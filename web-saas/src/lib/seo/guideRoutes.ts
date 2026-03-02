import type { IeltsGuide } from '@/lib/seo/ieltsGuides';

export const LEGACY_GUIDE_CANONICAL_PATH_MAP: Record<string, string> = {
  'ielts-speaking-practice-online': '/ielts/speaking/practice-online',
  'ielts-speaking-part-2-cue-card-strategy': '/ielts/speaking/part-2/cue-card-strategy',
  'ielts-speaking-part-3-follow-up-questions': '/ielts/speaking/part-3/follow-up-questions',
  'ielts-writing-task-2-guide': '/ielts/writing/task-2/guide',
  'ielts-writing-task-2-opinion-essay': '/ielts/writing/task-2/opinion-essay',
  'ielts-writing-task-1-academic': '/ielts/writing/task-1/academic',
  'ielts-writing-task-1-general-letter': '/ielts/writing/task-1/general-letter',
  'ielts-reading-question-types': '/ielts/reading/question-types/overview',
  'ielts-reading-true-false-not-given': '/ielts/reading/question-types/true-false-not-given',
  'ielts-reading-matching-headings': '/ielts/reading/question-types/matching-headings',
  'ielts-listening-band-score': '/ielts/listening/band-score-improvement',
  'ielts-listening-map-labelling-strategy': '/ielts/listening/question-types/map-labelling',
  'ielts-listening-multiple-choice-tips': '/ielts/listening/question-types/multiple-choice',
  'ielts-full-mock-test-online': '/ielts/exam-strategy/full-mock-tests/online',
  'ielts-academic-vs-general': '/ielts/exam-strategy/academic-vs-general',
  'ielts-study-plan-30-days': '/ielts/exam-strategy/study-plans/30-days',
  'ielts-band-7-in-60-days': '/ielts/band-scores/targets/band-7-in-60-days',
  'ielts-vocabulary-for-band-8': '/ielts/vocabulary/band-8',
  'ielts-grammar-mistakes-to-avoid': '/ielts/vocabulary/grammar/mistakes-to-avoid',
  'ielts-time-management-strategy': '/ielts/exam-strategy/time-management'
};

export const CANONICAL_TO_LEGACY_GUIDE_SLUG_MAP = Object.entries(LEGACY_GUIDE_CANONICAL_PATH_MAP).reduce<Record<string, string>>(
  (acc, [legacy, canonical]) => {
    acc[canonical] = legacy;
    return acc;
  },
  {}
);

export function normalizeIeltsPath(path: string): string {
  const trimmed = (path || '').trim();
  if (!trimmed) return '/ielts';

  const withoutQuery = trimmed.split('?')[0].split('#')[0];
  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  const compacted = withLeadingSlash.replace(/\/+/g, '/').replace(/\/$/, '');

  if (compacted === '/ielts') return compacted;
  if (compacted.startsWith('/ielts/')) return compacted;

  return `/ielts${compacted}`;
}

export function canonicalPathFromLegacySlug(slug: string): string | null {
  if (!slug) return null;
  return LEGACY_GUIDE_CANONICAL_PATH_MAP[slug] || null;
}

export function legacySlugFromCanonicalPath(path: string): string | null {
  return CANONICAL_TO_LEGACY_GUIDE_SLUG_MAP[normalizeIeltsPath(path)] || null;
}

export function canonicalPathFromGuide(guide: IeltsGuide): string {
  return canonicalPathFromLegacySlug(guide.slug) || `/ielts/resources/${guide.slug}`;
}

export function ieltsPathFromSegments(segments: string[]): string {
  if (!segments.length) return '/ielts';
  return normalizeIeltsPath(`/ielts/${segments.map(segment => encodeURIComponent(decodeURIComponent(segment))).join('/')}`);
}

export function pathSegmentsFromCanonical(path: string): string[] {
  return normalizeIeltsPath(path)
    .split('/')
    .filter(Boolean)
    .slice(1);
}
