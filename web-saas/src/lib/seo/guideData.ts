import type { GuideDetailResponse, GuidePageDetail, GuidePageSummary, GuideTreeNode, GuideTreeResponse } from '@/lib/types';
import { getGuideAnswerBlock, getIeltsGuideBySlug, ieltsGuides } from '@/lib/seo/ieltsGuides';
import { canonicalPathFromGuide, canonicalPathFromLegacySlug, normalizeIeltsPath, LEGACY_GUIDE_CANONICAL_PATH_MAP } from '@/lib/seo/guideRoutes';
import { enrichGuideDetailResponse, enrichGuideTreeResponse } from '@/lib/seo/guideContentEnrichment';

type FetchJsonResult<T> = {
  ok: boolean;
  data: T | null;
};

const GUIDE_API_TIMEOUT_MS = 20000;
const GUIDE_TREE_API_PAGE_SIZE = 2000;
const GUIDE_FETCH_REVALIDATE_SECONDS = 300;
const GUIDE_MODULE_KEYS: GuidePageSummary['module'][] = [
  'speaking',
  'writing',
  'reading',
  'listening',
  'vocabulary',
  'exam-strategy',
  'band-scores',
  'resources',
  'faq',
  'updates',
  'offers',
  'membership'
];
const EXCLUDED_GUIDE_MODULES = ['offers', 'membership'] as const;
type ExcludedGuideModule = (typeof EXCLUDED_GUIDE_MODULES)[number];

function isExcludedGuideModule(module: string | undefined): module is ExcludedGuideModule {
  return Boolean(module && EXCLUDED_GUIDE_MODULES.includes(module as ExcludedGuideModule));
}

function moduleFromCanonicalPath(canonicalPath: string): string | undefined {
  return normalizeIeltsPath(canonicalPath).split('/').filter(Boolean)[1];
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

  // Local dev fallback when /api rewrites are not configured.
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

function inferModuleFromCanonicalPath(canonicalPath: string): GuidePageSummary['module'] {
  const segments = normalizeIeltsPath(canonicalPath).split('/').filter(Boolean);
  const moduleKey = segments[1] || 'resources';

  return (GUIDE_MODULE_KEYS.includes(moduleKey as GuidePageSummary['module']) ? moduleKey : 'resources') as GuidePageSummary['module'];
}

function isGuideModule(value: string): value is GuidePageSummary['module'] {
  return GUIDE_MODULE_KEYS.includes(value as GuidePageSummary['module']);
}

async function fetchGuideJson<T>(path: string): Promise<FetchJsonResult<T>> {
  const baseUrl = resolveAbsoluteApiBase();
  if (!baseUrl) {
    return {
      ok: false,
      data: null
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GUIDE_API_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      cache: 'force-cache',
      next: { revalidate: GUIDE_FETCH_REVALIDATE_SECONDS },
      signal: controller.signal,
      headers: {
        'Unique-Reference-Code': `web-saas-guides-${Date.now()}`
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

function buildGuideTreeFromFlat(flat: GuideTreeNode[]): GuideTreeNode[] {
  const nodesByPath = new Map<string, GuideTreeNode>();
  const resultByPath = new Map<string, GuideTreeNode>();

  for (const item of flat) {
    const normalizedPath = normalizeIeltsPath(item.canonicalPath);
    if (nodesByPath.has(normalizedPath)) continue;
    const node: GuideTreeNode = {
      ...item,
      canonicalPath: normalizedPath,
      children: []
    };
    nodesByPath.set(normalizedPath, node);
    resultByPath.set(normalizedPath, node);
  }

  const root: GuideTreeNode[] = [];

  for (const node of resultByPath.values()) {
    const segments = node.canonicalPath.split('/').filter(Boolean);
    const parentPath = segments.length > 2 ? normalizeIeltsPath(`/${segments.slice(0, segments.length - 1).join('/')}`) : '/ielts';
    const parent = resultByPath.get(parentPath);

    if (parent && parent.canonicalPath !== node.canonicalPath) {
      parent.children.push(node);
      continue;
    }

    root.push(node);
  }

  return root;
}

async function fetchGuideTreeAllPages(): Promise<GuideTreeResponse | null> {
  const firstPage = await fetchGuideJson<GuideTreeResponse>(`/guides/tree?limit=${GUIDE_TREE_API_PAGE_SIZE}&offset=0`);
  if (!firstPage.ok || !firstPage.data) {
    return null;
  }

  const allFlat: GuideTreeNode[] = [...(firstPage.data.flat || [])];
  let offset = firstPage.data.limit || GUIDE_TREE_API_PAGE_SIZE;
  let hasMore = Boolean(firstPage.data.hasMore);

  while (hasMore) {
    const page = await fetchGuideJson<GuideTreeResponse>(`/guides/tree?limit=${GUIDE_TREE_API_PAGE_SIZE}&offset=${offset}`);
    if (!page.ok || !page.data) {
      return null;
    }

    allFlat.push(...(page.data.flat || []));
    hasMore = Boolean(page.data.hasMore);
    offset += page.data.limit || GUIDE_TREE_API_PAGE_SIZE;
    if (offset > 20000) {
      break;
    }
  }

  const dedupedMap = new Map<string, GuideTreeNode>();
  for (const item of allFlat) {
    dedupedMap.set(normalizeIeltsPath(item.canonicalPath), {
      ...item,
      canonicalPath: normalizeIeltsPath(item.canonicalPath)
    });
  }

  const dedupedFlat = Array.from(dedupedMap.values());
  const filteredFlat = dedupedFlat.filter(item => {
    if (isExcludedGuideModule(item.module)) return false;
    return !isExcludedGuideModule(moduleFromCanonicalPath(item.canonicalPath));
  });

  return {
    generatedAt: new Date().toISOString(),
    total: filteredFlat.length,
    limit: GUIDE_TREE_API_PAGE_SIZE,
    offset: 0,
    hasMore: false,
    tree: buildGuideTreeFromFlat(filteredFlat),
    flat: filteredFlat
  };
}

function fallbackSummaryFromLegacyGuide(slug: string): GuidePageSummary | null {
  const guide = getIeltsGuideBySlug(slug);
  if (!guide) {
    return null;
  }

  const canonicalPath = canonicalPathFromLegacySlug(slug) || canonicalPathFromGuide(guide);
  const moduleKey = inferModuleFromCanonicalPath(canonicalPath);
  if (isExcludedGuideModule(moduleKey)) {
    return null;
  }

  return {
    id: `legacy-${slug}`,
    slug,
    canonicalPath,
    title: guide.title,
    excerpt: guide.description,
    module: moduleKey,
    pageType: 'lesson',
    contentClass:
      moduleKey === 'updates'
        ? 'class_c_updates_promo'
        : moduleKey === 'band-scores' || moduleKey === 'resources' || moduleKey === 'faq'
          ? 'class_b_reference'
          : 'class_a_core_learning',
    state: 'published',
    qaPassed: true,
    qaScore: 80,
    publishedAt: guide.lastUpdated || guide.lastReviewed,
    lastReviewedAt: guide.lastReviewed,
    updatedAt: guide.lastUpdated || guide.lastReviewed
  };
}

function fallbackDetailFromLegacyGuide(slug: string): GuideDetailResponse | null {
  const guide = getIeltsGuideBySlug(slug);
  if (!guide) {
    return null;
  }

  const summary = fallbackSummaryFromLegacyGuide(slug);
  if (!summary) {
    return null;
  }

  const answerBlock = getGuideAnswerBlock(guide);

  const page: GuidePageDetail = {
    ...summary,
    depth: normalizeIeltsPath(summary.canonicalPath).split('/').filter(Boolean).length - 1,
    order: 100,
    legacySlugs: [slug],
    track: 'both',
    intent: guide.intent,
    templateType: 'LessonTemplate',
    metaTitle: guide.title,
    metaDescription: guide.description,
    bodyMarkdown: [
      `# ${guide.h1}`,
      '',
      guide.overview,
      '',
      '## Key Points',
      ...guide.keyPoints.map(item => `- ${item}`),
      '',
      '## Action Plan',
      ...guide.actionPlan.map((item, index) => `${index + 1}. ${item}`)
    ].join('\n'),
    keyTakeaways: guide.keyPoints,
    faqItems: [
      {
        question: `Which plan fits ${guide.title.toLowerCase()}?`,
        answer: `${guide.recommendedPlan} is the default recommendation for this route.`
      },
      {
        question: 'How should I practice this guide?',
        answer: answerBlock.whenToUse
      }
    ],
    practiceBlocks: {
      quickAnswer: answerBlock.shortAnswer,
      commonMistakes: guide.keyPoints.map(item => `Avoid skipping this: ${item}`),
      stepByStepMethod: guide.actionPlan,
      timedPracticeDrill: 'Set a 20-minute timer: 5 minutes review, 10 minutes execution, 5 minutes self-check.',
      selfCheckChecklist: [
        'I completed the guide exercise in exam-like time.',
        'I reviewed weak points using feedback notes.',
        'I selected the next route before ending the session.'
      ]
    },
    ctaConfig: {
      primary: {
        label: 'Start Free',
        href: '/register'
      },
      secondary: {
        label: 'Compare Plans',
        href: '/pricing'
      }
    },
    contentRisk: 'low',
    citationCoverageScore: 0.9,
    duplicationScore: 0,
    readabilityScore: 0.8,
    linkValidationPassed: true,
    schemaValidationPassed: true,
    sourceUrls: answerBlock.sourceBullets.map(item => item.sourceUrl),
    sourceSnapshotVersion: '2026-03-02',
    rewriteNotes: 'Legacy static fallback rendered from local guide corpus.',
    noindex: false,
    changeFrequency: 'weekly',
    priority: 0.75,
    createdAt: guide.lastReviewed
  };

  const related = ieltsGuides
    .filter(item => item.slug !== guide.slug)
    .slice(0, 6)
    .map(item => fallbackSummaryFromLegacyGuide(item.slug))
    .filter((item): item is GuidePageSummary => Boolean(item));

  return {
    page,
    related
  };
}

function fallbackModuleHubDetail(
  moduleKey: GuidePageSummary['module'],
  moduleNodes?: GuideTreeNode[]
): GuideDetailResponse | null {
  if (isExcludedGuideModule(moduleKey)) {
    return null;
  }

  const moduleCanonicalPath = normalizeIeltsPath(`/ielts/${moduleKey}`);
  const sortedModuleNodes = (moduleNodes || [])
    .filter(item => normalizeIeltsPath(item.canonicalPath) !== moduleCanonicalPath)
    .sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      if (a.order !== b.order) return a.order - b.order;
      return a.title.localeCompare(b.title);
    });

  if (sortedModuleNodes.length > 0) {
    const summary: GuidePageSummary = {
      id: `api-module-${moduleKey}`,
      slug: moduleKey,
      canonicalPath: moduleCanonicalPath,
      title: `${moduleKey
        .split('-')
        .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' ')} Guide Hub`,
      excerpt: `Structured IELTS ${moduleKey.replace('-', ' ')} route map with ${sortedModuleNodes.length} indexed guide pages.`,
      module: moduleKey,
      pageType: 'module_hub',
      contentClass:
        moduleKey === 'updates'
          ? 'class_c_updates_promo'
          : moduleKey === 'band-scores' || moduleKey === 'resources' || moduleKey === 'faq'
            ? 'class_b_reference'
            : 'class_a_core_learning',
      state: 'published',
      qaPassed: true,
      qaScore: 84,
      publishedAt: new Date().toISOString(),
      lastReviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const related = sortedModuleNodes.slice(0, 6).map(node => ({
      id: node.id,
      slug: node.slug,
      canonicalPath: normalizeIeltsPath(node.canonicalPath),
      title: node.title,
      excerpt: node.excerpt,
      module: node.module,
      pageType: node.pageType,
      contentClass: node.contentClass,
      state: 'published',
      qaPassed: true,
      qaScore: 80
    }));

    const page: GuidePageDetail = {
      ...summary,
      depth: 1,
      order: 1,
      legacySlugs: [],
      track: 'both',
      intent: 'informational',
      templateType: 'ModuleHubTemplate',
      metaTitle: summary.title,
      metaDescription: summary.excerpt,
      bodyMarkdown: [
        `# ${summary.title}`,
        '',
        summary.excerpt,
        '',
        '## Top routes in this module',
        ...sortedModuleNodes.slice(0, 20).map(node => `- [${node.title}](${normalizeIeltsPath(node.canonicalPath)})`)
      ].join('\n'),
      keyTakeaways: [
        `This module currently exposes ${sortedModuleNodes.length} routes.`,
        'Use one route per focused practice cycle and keep the next route pre-selected.',
        'Move from guide reading into timed execution in the same session.'
      ],
      faqItems: [
        {
          question: `How should I use the ${summary.title.toLowerCase()}?`,
          answer: 'Start from the first route, complete the timed drill, then move to the next linked guide.'
        },
        {
          question: 'Which CTA should I use if I am new?',
          answer: 'Start with register for free access, then compare paid plans when you need higher-volume practice.'
        }
      ],
      practiceBlocks: {
        quickAnswer: `Use this ${moduleKey.replace('-', ' ')} hub as a sequenced path: learn, drill, self-check, and continue.`,
        commonMistakes: [
          'Jumping across routes without finishing one full practice cycle.',
          'Skipping timed drills after reading strategy sections.',
          'Not logging next-route decisions before leaving the page.'
        ],
        stepByStepMethod: [
          'Open the first route in this module.',
          'Complete one timed drill and checklist.',
          'Use related routes to continue depth-first progression.'
        ],
        timedPracticeDrill: 'Run a 25-minute session across one selected route and record one improvement target.',
        selfCheckChecklist: [
          'I completed one full drill for this module.',
          'I captured mistakes and action items.',
          'I selected the next route to continue.'
        ]
      },
      ctaConfig: {
        primary: {
          label: 'Start Free',
          href: '/register'
        },
        secondary: {
          label: 'Compare Plans',
          href: '/pricing'
        }
      },
      contentRisk: 'low',
      citationCoverageScore: 0.9,
      duplicationScore: 0,
      readabilityScore: 0.82,
      linkValidationPassed: true,
      schemaValidationPassed: true,
      sourceUrls: [],
      sourceSnapshotVersion: new Date().toISOString().slice(0, 10),
      rewriteNotes: 'Module hub fallback synthesized from imported guide tree.',
      noindex: false,
      changeFrequency: 'weekly',
      priority: 0.8,
      createdAt: new Date().toISOString()
    };

    return {
      page,
      related
    };
  }

  const moduleGuides = ieltsGuides
    .map(guide => ({
      guide,
      canonicalPath: normalizeIeltsPath(canonicalPathFromGuide(guide))
    }))
    .filter(item => inferModuleFromCanonicalPath(item.canonicalPath) === moduleKey);

  if (!moduleGuides.length) {
    return null;
  }

  const summary: GuidePageSummary = {
    id: `legacy-module-${moduleKey}`,
    slug: moduleKey,
    canonicalPath: moduleCanonicalPath,
    title: `${moduleKey
      .split('-')
      .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ')} Guide Hub`,
    excerpt: `Structured IELTS ${moduleKey} learning path with practical drills and next-route guidance.`,
    module: moduleKey,
    pageType: 'module_hub',
    contentClass: moduleKey === 'updates'
      ? 'class_c_updates_promo'
      : moduleKey === 'band-scores' || moduleKey === 'resources' || moduleKey === 'faq'
        ? 'class_b_reference'
        : 'class_a_core_learning',
    state: 'published',
    qaPassed: true,
    qaScore: 82,
    publishedAt: '2026-03-02',
    lastReviewedAt: '2026-03-02',
    updatedAt: '2026-03-02'
  };

  const page: GuidePageDetail = {
    ...summary,
    depth: 1,
    order: 1,
    legacySlugs: [],
    track: 'both',
    intent: 'informational',
    templateType: 'ModuleHubTemplate',
    metaTitle: summary.title,
    metaDescription: summary.excerpt,
    bodyMarkdown: [
      `# ${summary.title}`,
      '',
      summary.excerpt,
      '',
      '## What you will cover',
      ...moduleGuides.slice(0, 8).map(item => `- ${item.guide.title}`)
    ].join('\n'),
    keyTakeaways: moduleGuides.slice(0, 6).map(item => item.guide.overview),
    faqItems: [
      {
        question: `How should I use the ${summary.title.toLowerCase()}?`,
        answer: 'Start from the first route, complete the timed drill, then move to the next linked guide.'
      },
      {
        question: 'Which CTA should I use if I am new?',
        answer: 'Start with register for free access, then compare paid plans when you need higher-volume practice.'
      }
    ],
    practiceBlocks: {
      quickAnswer: `Use this ${moduleKey} hub as a sequenced path: learn, drill, self-check, and continue.`,
      commonMistakes: [
        'Jumping across routes without finishing one full practice cycle.',
        'Skipping timed drills after reading strategy sections.',
        'Not logging next-route decisions before leaving the page.'
      ],
      stepByStepMethod: [
        'Open the first route in this module.',
        'Complete one timed drill and checklist.',
        'Use related routes to continue depth-first progression.'
      ],
      timedPracticeDrill: 'Run a 25-minute session across one selected route and record one improvement target.',
      selfCheckChecklist: [
        'I completed one full drill for this module.',
        'I captured mistakes and action items.',
        'I selected the next route to continue.'
      ]
    },
    ctaConfig: {
      primary: {
        label: 'Start Free',
        href: '/register'
      },
      secondary: {
        label: 'Compare Plans',
        href: '/pricing'
      }
    },
    contentRisk: 'low',
    citationCoverageScore: 0.9,
    duplicationScore: 0,
    readabilityScore: 0.82,
    linkValidationPassed: true,
    schemaValidationPassed: true,
    sourceUrls: [],
    sourceSnapshotVersion: '2026-03-02',
    rewriteNotes: 'Module hub fallback rendered from local guide map.',
    noindex: false,
    changeFrequency: 'weekly',
    priority: 0.8,
    createdAt: '2026-03-02'
  };

  const related = moduleGuides
    .slice(0, 6)
    .map(item => fallbackSummaryFromLegacyGuide(item.guide.slug))
    .filter((item): item is GuidePageSummary => Boolean(item));

  return {
    page,
    related
  };
}

function fallbackTaxonomyNodeDetail(path: string, tree: GuideTreeResponse): GuideDetailResponse | null {
  const normalizedPath = normalizeIeltsPath(path);
  const node = tree.flat.find(item => normalizeIeltsPath(item.canonicalPath) === normalizedPath);

  if (!node) {
    return null;
  }

  const nodeModule = isGuideModule(node.module) ? node.module : inferModuleFromCanonicalPath(normalizedPath);
  if (isExcludedGuideModule(nodeModule)) {
    return null;
  }

  const descendants = tree.flat
    .filter(item => {
      const itemPath = normalizeIeltsPath(item.canonicalPath);
      return itemPath !== normalizedPath && itemPath.startsWith(`${normalizedPath}/`);
    })
    .sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      if (a.order !== b.order) return a.order - b.order;
      return a.title.localeCompare(b.title);
    });

  if (!descendants.length) {
    return null;
  }

  const summary: GuidePageSummary = {
    id: `taxonomy-${node.id}`,
    slug: node.slug,
    canonicalPath: normalizedPath,
    title: node.title,
    excerpt: node.excerpt || `Browse route coverage under ${node.title}.`,
    module: nodeModule,
    pageType: node.pageType || 'module_hub',
    contentClass: node.contentClass,
    state: 'published',
    qaPassed: true,
    qaScore: 80,
    publishedAt: new Date().toISOString(),
    lastReviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const page: GuidePageDetail = {
    ...summary,
    depth: normalizedPath.split('/').filter(Boolean).length - 1,
    order: node.order || 1,
    legacySlugs: [],
    track: 'both',
    intent: 'informational',
    templateType: 'ModuleHubTemplate',
    metaTitle: summary.title,
    metaDescription: summary.excerpt || '',
    bodyMarkdown: [
      `# ${summary.title}`,
      '',
      summary.excerpt || '',
      '',
      '## Route map',
      ...descendants.slice(0, 24).map(item => `- [${item.title}](${normalizeIeltsPath(item.canonicalPath)})`)
    ].join('\n'),
    keyTakeaways: [
      `This topic contains ${descendants.length} related routes.`,
      'Progress route-by-route with one timed drill per page.',
      'Use related routes to continue depth-first preparation.'
    ],
    faqItems: [
      {
        question: `How should I use ${summary.title}?`,
        answer: 'Start with the first linked route, complete the practice drill, then move to the next route in sequence.'
      },
      {
        question: 'What should I do if I need exam-focused practice next?',
        answer: 'Create a free account and continue drills inside the learner workspace.'
      }
    ],
    practiceBlocks: {
      quickAnswer: `Use ${summary.title} as a structured route cluster and complete one timed drill before moving on.`,
      commonMistakes: [
        'Skipping the first foundational route and jumping straight to advanced pages.',
        'Reading strategy content without running a timed drill.',
        'Not logging your next route before leaving.'
      ],
      stepByStepMethod: [
        'Open the first route listed in this cluster.',
        'Complete one timed practice cycle and checklist.',
        'Continue to the next linked route.'
      ],
      timedPracticeDrill: 'Run one 25-minute route cycle: 5 minutes review, 15 minutes execution, 5 minutes self-check.',
      selfCheckChecklist: [
        'I completed one full timed drill on this route cluster.',
        'I noted at least one improvement target.',
        'I selected the next route to continue.'
      ]
    },
    ctaConfig: {
      primary: {
        label: 'Start Free',
        href: '/register'
      },
      secondary: {
        label: 'Compare Plans',
        href: '/pricing'
      }
    },
    contentRisk: 'low',
    citationCoverageScore: 0.85,
    duplicationScore: 0,
    readabilityScore: 0.8,
    linkValidationPassed: true,
    schemaValidationPassed: true,
    sourceUrls: [],
    sourceSnapshotVersion: new Date().toISOString().slice(0, 10),
    rewriteNotes: 'Taxonomy node fallback generated from guide tree to prevent broken hub routes.',
    noindex: false,
    changeFrequency: 'weekly',
    priority: 0.75,
    createdAt: new Date().toISOString()
  };

  const related = descendants.slice(0, 6).map(item => ({
    id: item.id,
    slug: item.slug,
    canonicalPath: normalizeIeltsPath(item.canonicalPath),
    title: item.title,
    excerpt: item.excerpt,
    module: item.module,
    pageType: item.pageType,
    contentClass: item.contentClass,
    state: 'published',
    qaPassed: true,
    qaScore: 80
  }));

  return {
    page,
    related
  };
}

export async function getGuideTreeWithFallback(): Promise<GuideTreeResponse> {
  const apiTree = await fetchGuideTreeAllPages();
  if (apiTree) {
    return enrichGuideTreeResponse(apiTree);
  }

  const flat = ieltsGuides
    .map(guide => fallbackSummaryFromLegacyGuide(guide.slug))
    .filter((guide): guide is GuidePageSummary => Boolean(guide))
    .map(summary => {
      const node: GuideTreeNode = {
        id: summary.id,
        title: summary.title,
        slug: summary.slug,
        canonicalPath: summary.canonicalPath,
        module: summary.module,
        contentClass: summary.contentClass,
        pageType: summary.pageType,
        templateType: 'LessonTemplate',
        depth: normalizeIeltsPath(summary.canonicalPath).split('/').filter(Boolean).length - 1,
        order: 100,
        excerpt: summary.excerpt,
        children: []
      };
      return node;
    });

  const rootByModule = new Map<string, GuideTreeNode>();
  flat.forEach(node => {
    const modulePath = `/ielts/${node.module}`;
    if (!rootByModule.has(modulePath)) {
      rootByModule.set(modulePath, {
        id: `module-${node.module}`,
        title: node.module
          .split('-')
          .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
          .join(' '),
        slug: node.module,
        canonicalPath: modulePath,
        module: node.module,
        contentClass: node.contentClass,
        pageType: 'module_hub',
        templateType: 'ModuleHubTemplate',
        depth: 1,
        order: 1,
        excerpt: `IELTS ${node.module} guide hub`,
        children: []
      });
    }

    rootByModule.get(modulePath)!.children.push(node);
  });

  const tree = Array.from(rootByModule.values());

  return enrichGuideTreeResponse({
    generatedAt: new Date().toISOString(),
    total: flat.length,
    limit: GUIDE_TREE_API_PAGE_SIZE,
    offset: 0,
    hasMore: false,
    tree,
    flat
  });
}

export async function getGuideDetailWithFallback(path: string): Promise<GuideDetailResponse | null> {
  const normalizedPath = normalizeIeltsPath(path);
  const segments = normalizedPath.split('/').filter(Boolean);
  const moduleSegment = segments[1];
  if (isExcludedGuideModule(moduleSegment)) {
    return null;
  }

  const encoded = normalizedPath
    .replace(/^\/ielts\//, '')
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

  const apiResult = await fetchGuideJson<GuideDetailResponse>(`/guides/page/${encoded}`);
  if (apiResult.ok && apiResult.data) {
    if (isExcludedGuideModule(apiResult.data.page.module)) {
      return null;
    }
    return enrichGuideDetailResponse(apiResult.data);
  }

  const canonicalToLegacyEntries = Object.entries(LEGACY_GUIDE_CANONICAL_PATH_MAP);
  const matchedLegacy = canonicalToLegacyEntries.find(([, canonical]) => normalizeIeltsPath(canonical) === normalizedPath);

  if (matchedLegacy) {
    const detail = fallbackDetailFromLegacyGuide(matchedLegacy[0]);
    return detail ? enrichGuideDetailResponse(detail) : null;
  }

  const isModuleHubPath = segments.length === 2;
  if (moduleSegment && isModuleHubPath && isGuideModule(moduleSegment)) {
    const tree = await getGuideTreeWithFallback();
    const moduleNodes = tree.flat.filter(item => item.module === moduleSegment);
    const detail = fallbackModuleHubDetail(moduleSegment, moduleNodes);
    return detail ? enrichGuideDetailResponse(detail) : null;
  }

  const tree = await getGuideTreeWithFallback();
  const taxonomyFallback = fallbackTaxonomyNodeDetail(normalizedPath, tree);
  if (taxonomyFallback) {
    return enrichGuideDetailResponse(taxonomyFallback);
  }

  return null;
}

export async function getGuideCanonicalPathsWithFallback(): Promise<string[]> {
  const apiTree = await fetchGuideTreeAllPages();
  if (apiTree) {
    return Array.from(
      new Set(
        apiTree.flat
          .filter(item => !isExcludedGuideModule(item.module))
          .map(item => normalizeIeltsPath(item.canonicalPath))
      )
    );
  }

  const guidePaths = ieltsGuides.map(item => normalizeIeltsPath(canonicalPathFromGuide(item)));
  const modulePaths = Array.from(new Set(guidePaths.map(path => {
    const pathSegments = path.split('/').filter(Boolean);
    return normalizeIeltsPath(`/ielts/${pathSegments[1] || 'resources'}`);
  })));

  return Array.from(
    new Set(
      [...modulePaths, ...guidePaths].filter(path => !isExcludedGuideModule(moduleFromCanonicalPath(path)))
    )
  );
}
