import { Service } from 'typedi';

import { env } from '@env';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { Types } from '@lib/db/mongooseCompat';
import { Logger } from '@lib/logger';
import { getPgPool } from '@lib/db/pgClient';
import {
  GuidePageModel,
  type GuideContentClass,
  type GuideModule,
  type GuidePageType,
  type GuideTemplateType,
  type GuideState,
  type IGuidePage
} from '@models/GuidePageModel';
import { GuideSourceMapModel } from '@models/GuideSourceMapModel';
import { GuideQaReportModel } from '@models/GuideQaReportModel';
import { GuideImportJobModel } from '@models/GuideImportJobModel';
import { GuideTaxonomyNodeModel } from '@models/GuideTaxonomyNodeModel';

const DEFAULT_SITEMAPS = [
  'https://ieltsliz.com/page-sitemap.html',
  'https://ieltsliz.com/post-sitemap.html',
  'https://ieltsliz.com/sitemap-misc.html'
];

const GUIDE_MODULES: GuideModule[] = [
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

const GUIDE_CONTENT_CLASSES: GuideContentClass[] = [
  'class_a_core_learning',
  'class_b_reference',
  'class_c_updates_promo'
];

const GUIDE_PAGE_TYPES: GuidePageType[] = [
  'module_hub',
  'question_bank',
  'lesson',
  'model_answer',
  'faq_reference',
  'update',
  'offer',
  'membership_info'
];

const GUIDE_TEMPLATE_TYPES: GuideTemplateType[] = [
  'ModuleHubTemplate',
  'QuestionBankTemplate',
  'LessonTemplate',
  'ModelAnswerTemplate',
  'FAQReferenceTemplate',
  'UpdateTemplate',
  'OfferTemplate',
  'MembershipInfoTemplate'
];

const GUIDE_STATES: GuideState[] = [
  'inventory',
  'mapped',
  'outline_ready',
  'drafting',
  'review',
  'qa_passed',
  'published',
  'archived'
];

type Pagination = {
  limit: number;
  offset: number;
};

type GuideQaScore = {
  qaPassed: boolean;
  qaScore: number;
  citationCoverageScore: number;
  duplicationScore: number;
  readabilityScore: number;
  linkValidationPassed: boolean;
  schemaValidationPassed: boolean;
  warnings: string[];
};

type GuideTreeNode = {
  id: string;
  title: string;
  slug: string;
  canonicalPath: string;
  module: GuideModule;
  contentClass: GuideContentClass;
  pageType: GuidePageType;
  templateType: GuideTemplateType;
  depth: number;
  order: number;
  excerpt?: string;
  children: GuideTreeNode[];
};

export function normalizeGuideCanonicalPath(rawPath: string): string {
  const trimmed = (rawPath || '').trim();
  if (!trimmed) {
    return '/ielts';
  }

  const withoutQuery = trimmed.split('?')[0].split('#')[0];
  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  const normalized = withLeadingSlash.replace(/\/+/g, '/').replace(/\/$/, '');

  if (normalized === '/ielts') {
    return normalized;
  }

  if (normalized.startsWith('/ielts/')) {
    return normalized;
  }

  return `/ielts${normalized}`;
}

export function slugifyGuideText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function inferGuideModuleFromSourceUrl(sourceUrl: string): GuideModule {
  const safe = sourceUrl.toLowerCase();

  if (safe.includes('speaking')) return 'speaking';
  if (safe.includes('writing')) return 'writing';
  if (safe.includes('reading')) return 'reading';
  if (safe.includes('listening')) return 'listening';
  if (safe.includes('vocabulary') || safe.includes('grammar') || safe.includes('collocation')) return 'vocabulary';
  if (safe.includes('band-score') || safe.includes('band')) return 'band-scores';
  if (safe.includes('membership')) return 'membership';
  if (safe.includes('offer') || safe.includes('discount') || safe.includes('deal')) return 'offers';
  if (safe.includes('update') || /\b20\d{2}\b/.test(safe)) return 'updates';
  if (safe.includes('resource') || safe.includes('book') || safe.includes('tool')) return 'resources';
  if (safe.includes('faq') || safe.includes('question')) return 'faq';

  return 'exam-strategy';
}

export function inferGuideContentClass(module: GuideModule): GuideContentClass {
  if (['speaking', 'writing', 'reading', 'listening', 'vocabulary', 'exam-strategy'].includes(module)) {
    return 'class_a_core_learning';
  }

  if (['band-scores', 'resources', 'faq'].includes(module)) {
    return 'class_b_reference';
  }

  return 'class_c_updates_promo';
}

export function inferGuidePageType(module: GuideModule): GuidePageType {
  if (module === 'faq') return 'faq_reference';
  if (module === 'updates') return 'update';
  if (module === 'offers') return 'offer';
  if (module === 'membership') return 'membership_info';
  if (module === 'resources') return 'question_bank';
  return 'lesson';
}

export function inferGuideTemplateType(pageType: GuidePageType): GuideTemplateType {
  const map: Record<GuidePageType, GuideTemplateType> = {
    module_hub: 'ModuleHubTemplate',
    question_bank: 'QuestionBankTemplate',
    lesson: 'LessonTemplate',
    model_answer: 'ModelAnswerTemplate',
    faq_reference: 'FAQReferenceTemplate',
    update: 'UpdateTemplate',
    offer: 'OfferTemplate',
    membership_info: 'MembershipInfoTemplate'
  };

  return map[pageType];
}

export function inferGuideDestinationPath(sourceUrl: string): string {
  try {
    const parsed = new URL(sourceUrl);
    const originalSlug = parsed.pathname
      .split('/')
      .filter(Boolean)
      .pop();

    const baseSlug = slugifyGuideText(originalSlug || 'guide');
    const module = inferGuideModuleFromSourceUrl(sourceUrl);

    if (baseSlug.startsWith('ielts-')) {
      const shortSlug = baseSlug.replace(/^ielts-/, '');
      return normalizeGuideCanonicalPath(`${module}/${shortSlug}`);
    }

    return normalizeGuideCanonicalPath(`${module}/${baseSlug}`);
  } catch {
    return normalizeGuideCanonicalPath(`resources/${slugifyGuideText(sourceUrl) || 'guide'}`);
  }
}

function inferPublishWaveByModule(module: GuideModule): 1 | 2 | 3 {
  if (['speaking', 'writing', 'reading', 'listening', 'vocabulary', 'exam-strategy'].includes(module)) {
    return 1;
  }
  if (['band-scores', 'resources', 'faq'].includes(module)) {
    return 2;
  }
  return 3;
}

@Service()
export class GuideService {
  private readonly log = new Logger(__filename);

  public async listPublicGuideTree(query: {
    module?: GuideModule;
    contentClass?: GuideContentClass;
    limit?: number;
    offset?: number;
  }) {
    const { limit, offset } = this.resolvePagination(query.limit, query.offset, 500, 0, 2000);
    const rows = await this.fetchPublicGuideRows({
      module: query.module,
      contentClass: query.contentClass,
      limit,
      offset,
      enforceNoindex: true
    });
    const total = await this.countPublicGuideRows({
      module: query.module,
      contentClass: query.contentClass,
      enforceNoindex: true
    });

    const byPath = new Map<string, GuideTreeNode>();
    const nodes: GuideTreeNode[] = rows.map(row => {
      const node: GuideTreeNode = {
        id: String(row._id),
        title: row.title,
        slug: row.slug,
        canonicalPath: row.canonicalPath,
        module: row.module,
        contentClass: row.contentClass,
        pageType: row.pageType,
        templateType: row.templateType,
        depth: row.depth,
        order: row.order,
        excerpt: row.excerpt,
        children: []
      };
      byPath.set(row.canonicalPath, node);
      return node;
    });

    const root: GuideTreeNode[] = [];
    const byId = new Map<string, GuideTreeNode>(nodes.map(node => [node.id, node]));

    rows.forEach(row => {
      const node = byId.get(String(row._id));
      if (!node) {
        return;
      }

      const parentId = row.parentId?.toString();
      const directParent = parentId ? byId.get(parentId) : undefined;

      if (directParent) {
        directParent.children.push(node);
        return;
      }

      const parentPath = this.parentPath(row.canonicalPath);
      const pathParent = parentPath ? byPath.get(parentPath) : undefined;

      if (pathParent) {
        pathParent.children.push(node);
      } else {
        root.push(node);
      }
    });

    return {
      generatedAt: new Date().toISOString(),
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total,
      tree: root,
      flat: nodes
    };
  }

  public async getPublicGuidePageByPath(path: string) {
    const normalizedPath = normalizeGuideCanonicalPath(path);
    const slugCandidate = normalizedPath.split('/').filter(Boolean).pop() || '';
    let row = await this.fetchPublicGuidePageRow({
      normalizedPath,
      slugCandidate
    });

    if (!row) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Guide page not found');
    }

    const related = await this.findRelatedGuides(String(row._id), row.module, 6);

    return {
      page: this.toGuideDetail(row),
      related
    };
  }

  public async listRelatedPublicGuides(guideId: string, limit = 6) {
    const row = await this.fetchGuideRowById(guideId);
    if (!row) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Guide page not found');
    }

    return {
      related: await this.findRelatedGuides(guideId, row.module, limit)
    };
  }

  public async searchPublicGuides(query: {
    q: string;
    module?: GuideModule;
    pageType?: GuidePageType;
    limit?: number;
    offset?: number;
  }) {
    const { limit, offset } = this.resolvePagination(query.limit, query.offset, 20, 0, 100);
    const rows = await this.fetchPublicGuideRows({
      module: query.module,
      pageType: query.pageType,
      q: query.q,
      limit,
      offset,
      enforceNoindex: true,
      sortByLatest: true
    });
    const total = await this.countPublicGuideRows({
      module: query.module,
      pageType: query.pageType,
      q: query.q,
      enforceNoindex: true
    });

    return {
      results: rows.map(row => this.toGuideSummary(row)),
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total
    };
  }

  public async listAdminGuidePages(query: {
    state?: GuideState;
    module?: GuideModule;
    contentClass?: GuideContentClass;
    limit?: number;
    offset?: number;
  }) {
    const { limit, offset } = this.resolvePagination(query.limit, query.offset, 20, 0, 200);
    const filter: Record<string, unknown> = {};

    if (query.state) {
      filter.state = query.state;
    }
    if (query.module) {
      filter.module = query.module;
    }
    if (query.contentClass) {
      filter.contentClass = query.contentClass;
    }

    const [rows, total] = await Promise.all([
      GuidePageModel.find(filter).sort({ updatedAt: -1 }).skip(offset).limit(limit).lean(),
      GuidePageModel.countDocuments(filter)
    ]);

    return {
      pages: rows.map(row => this.toGuideDetail(row)),
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total
    };
  }

  public async listGuideImportJobs(query: { limit?: number; offset?: number }) {
    const { limit, offset } = this.resolvePagination(query.limit, query.offset, 20, 0, 200);

    const [rows, total] = await Promise.all([
      GuideImportJobModel.find({}).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      GuideImportJobModel.countDocuments({})
    ]);

    return {
      jobs: rows.map(row => ({
        id: row._id.toString(),
        type: row.type,
        status: row.status,
        payload: row.payload || {},
        result: row.result || {},
        error: row.error,
        startedAt: row.startedAt?.toISOString(),
        finishedAt: row.finishedAt?.toISOString(),
        createdAt: row.createdAt?.toISOString(),
        updatedAt: row.updatedAt?.toISOString()
      })),
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total
    };
  }

  public async importGuideSitemaps(input: { sitemaps?: string[]; inventoryDate?: string }, actorUserId: string) {
    const actor = this.toObjectId(actorUserId, 'Invalid actor user id');
    const sitemaps = (input.sitemaps || DEFAULT_SITEMAPS).filter(Boolean);
    const inventoryDate = input.inventoryDate || new Date().toISOString().slice(0, 10);

    if (!sitemaps.length) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'At least one sitemap URL is required');
    }

    const job = await GuideImportJobModel.create({
      type: 'sitemap_import',
      status: 'running',
      payload: {
        sitemaps,
        inventoryDate
      },
      createdByUserId: actor,
      startedAt: new Date()
    });

    try {
      const discovered = new Map<string, { sourceType: 'page' | 'post' | 'misc'; lastmod?: string }>();

      for (const sitemapUrl of sitemaps) {
        const sourceType: 'page' | 'post' | 'misc' = sitemapUrl.includes('page-sitemap')
          ? 'page'
          : sitemapUrl.includes('misc')
            ? 'misc'
            : 'post';

        const text = await this.downloadSitemap(sitemapUrl);
        const entries = this.extractSitemapEntries(text);
        entries.forEach(entry => {
          if (!entry.url) return;
          discovered.set(entry.url, {
            sourceType,
            lastmod: entry.lastmod
          });
        });
      }

      let sourceMapsUpserted = 0;
      let pagesCreated = 0;
      let pagesUpdated = 0;
      let failedEntries = 0;
      const failureSamples: string[] = [];
      const discoveredEntries = Array.from(discovered.entries());

      const uniqueModules = Array.from(new Set(discoveredEntries.map(([sourceUrl]) => inferGuideModuleFromSourceUrl(sourceUrl))));
      await Promise.all(
        uniqueModules.map(module =>
          GuideTaxonomyNodeModel.findOneAndUpdate(
            { key: `${module}` },
            {
              $setOnInsert: {
                key: module,
                name: this.moduleDisplayName(module),
                slug: module,
                module,
                contentClass: inferGuideContentClass(module),
                order: this.priorityForModule(module),
                depth: 1,
                active: true
              }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          )
        )
      );

      const parsedConcurrency = Number(process.env.GUIDE_IMPORT_CONCURRENCY || 16);
      const concurrency = Number.isFinite(parsedConcurrency) ? Math.max(1, Math.min(32, parsedConcurrency)) : 16;
      let cursor = 0;

      const processEntry = async (entry: [string, { sourceType: 'page' | 'post' | 'misc'; lastmod?: string }]) => {
        const [sourceUrl, meta] = entry;
        const module = inferGuideModuleFromSourceUrl(sourceUrl);
        const contentClass = inferGuideContentClass(module);
        const pageType = inferGuidePageType(module);
        const templateType = inferGuideTemplateType(pageType);
        const destinationPath = inferGuideDestinationPath(sourceUrl);
        const destinationSlug = destinationPath.split('/').filter(Boolean).pop() || 'guide';
        const seed = this.buildSeedGuideContent({
          sourceUrl,
          title: this.titleFromSlug(destinationSlug),
          module,
          pageType,
          contentClass
        });

        await GuideSourceMapModel.findOneAndUpdate(
          { sourceUrl },
          {
            $set: {
              sourceType: meta.sourceType,
              lastmod: meta.lastmod,
              moduleGuess: module,
              intent: this.inferIntent(sourceUrl),
              contentClass,
              destinationPath,
              templateType,
              module,
              pageType,
              priority: this.priorityForModule(module),
              publishWave: inferPublishWaveByModule(module),
              status: 'mapped',
              inventoryDate
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        sourceMapsUpserted += 1;

        const existing = await GuidePageModel.findOne({ canonicalPath: destinationPath }).lean();
        if (existing?._id) {
          pagesUpdated += 1;
        } else {
          pagesCreated += 1;
        }

        const insertPayload = {
          slug: destinationSlug,
          canonicalPath: destinationPath,
          legacySlugs: [destinationSlug],
          depth: destinationPath.split('/').filter(Boolean).length - 1,
          order: this.priorityForModule(module),
          module,
          pageType,
          intent: this.inferIntent(sourceUrl),
          contentClass,
          templateType,
          title: seed.title,
          metaTitle: seed.metaTitle,
          metaDescription: seed.metaDescription,
          excerpt: seed.excerpt,
          bodyMarkdown: seed.bodyMarkdown,
          keyTakeaways: seed.keyTakeaways,
          faqItems: seed.faqItems,
          practiceBlocks: seed.practiceBlocks,
          ctaConfig: seed.ctaConfig,
          state: 'outline_ready',
          contentRisk: 'medium',
          sourceUrls: [sourceUrl],
          sourceSnapshotVersion: inventoryDate,
          noindex: false,
          changeFrequency: module === 'updates' ? 'daily' : 'weekly',
          priority: module === 'updates' ? 0.9 : 0.75,
          qaPassed: false,
          qaScore: 0,
          citationCoverageScore: 0,
          duplicationScore: 0,
          readabilityScore: 0,
          linkValidationPassed: false,
          schemaValidationPassed: false,
          authorId: actor,
          reviewerId: actor
        };

        const qa = this.scoreGuideQa(insertPayload as Partial<IGuidePage>);
        insertPayload.qaPassed = qa.qaPassed;
        insertPayload.qaScore = qa.qaScore;
        insertPayload.citationCoverageScore = qa.citationCoverageScore;
        insertPayload.duplicationScore = qa.duplicationScore;
        insertPayload.readabilityScore = qa.readabilityScore;
        insertPayload.linkValidationPassed = qa.linkValidationPassed;
        insertPayload.schemaValidationPassed = qa.schemaValidationPassed;

        await GuidePageModel.findOneAndUpdate(
          { canonicalPath: destinationPath },
          {
            $setOnInsert: insertPayload,
            $set: {
              sourceSnapshotVersion: inventoryDate
            },
            $addToSet: {
              sourceUrls: sourceUrl,
              legacySlugs: destinationSlug
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      };

      const workers = Array.from({ length: Math.min(concurrency, discoveredEntries.length || 1) }, () => (async () => {
        while (true) {
          const nextIndex = cursor;
          cursor += 1;
          if (nextIndex >= discoveredEntries.length) {
            break;
          }

          try {
            await processEntry(discoveredEntries[nextIndex]);
          } catch (entryError: any) {
            failedEntries += 1;
            if (failureSamples.length < 20) {
              failureSamples.push(
                `${discoveredEntries[nextIndex][0]} :: ${entryError?.message || 'unknown error'}`
              );
            }
          }
        }
      })());

      await Promise.all(workers);

      job.status = 'completed';
      job.result = {
        discoveredUrls: discovered.size,
        sourceMapsUpserted,
        pagesCreated,
        pagesUpdated,
        failedEntries,
        failureSamples
      };
      job.finishedAt = new Date();
      await job.save();

      return {
        jobId: job._id.toString(),
        status: job.status,
        discoveredUrls: discovered.size,
        sourceMapsUpserted,
        pagesCreated,
        pagesUpdated,
        failedEntries,
        failureSamples,
        inventoryDate
      };
    } catch (error: any) {
      job.status = 'failed';
      job.error = error?.message || 'Guide sitemap import failed';
      job.finishedAt = new Date();
      await job.save();

      this.log.error('Guide sitemap import failed', {
        error,
        sitemaps,
        inventoryDate
      });

      throw error;
    }
  }

  public async generateGuideOutline(pageId: string, input: { strategyHint?: string }, actorUserId: string) {
    const actor = this.toObjectId(actorUserId, 'Invalid actor user id');
    const page = await GuidePageModel.findById(pageId);

    if (!page) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Guide page not found');
    }

    const title = page.title || this.titleFromSlug(page.slug);
    const strategyHint = input.strategyHint?.trim();

    const outline = [
      `# ${title}`,
      '',
      '## Quick Answer',
      '- Give a direct answer in 3-4 sentences.',
      '',
      '## Common Mistakes',
      '- Mistake 1',
      '- Mistake 2',
      '',
      '## Step-by-Step Method',
      '1. Explain the first action.',
      '2. Show what to verify before moving on.',
      '3. Provide an exam-timed execution format.',
      '',
      '## Timed Practice Drill',
      '- 15-minute drill with success criteria.',
      '',
      '## Self-check Checklist',
      '- [ ] I covered all prompt requirements.',
      '- [ ] I stayed within recommended time.',
      '- [ ] I used module-specific scoring logic.'
    ];

    if (strategyHint) {
      outline.push('', `## Strategy Constraint`, `- ${strategyHint}`);
    }

    page.bodyMarkdown = outline.join('\n');
    page.state = 'outline_ready';
    page.authorId = actor;
    page.sourceSnapshotVersion = page.sourceSnapshotVersion || new Date().toISOString().slice(0, 10);
    page.rewriteNotes = [
      page.rewriteNotes,
      `Outline generated at ${new Date().toISOString()} (AI outline only; human rewrite required).`
    ]
      .filter(Boolean)
      .join('\n');

    const qa = this.scoreGuideQa(page);
    this.applyQaToPage(page, qa);
    await page.save();

    await GuideQaReportModel.create({
      guidePageId: page._id,
      citationCoverageScore: qa.citationCoverageScore,
      duplicationScore: qa.duplicationScore,
      readabilityScore: qa.readabilityScore,
      linkValidationPassed: qa.linkValidationPassed,
      schemaValidationPassed: qa.schemaValidationPassed,
      passed: qa.qaPassed,
      warnings: qa.warnings,
      createdByUserId: actor
    });

    return {
      page: this.toGuideDetail(page)
    };
  }

  public async updateGuidePage(pageId: string, input: Record<string, unknown>, actorUserId: string) {
    const actor = this.toObjectId(actorUserId, 'Invalid actor user id');
    const page = await GuidePageModel.findById(pageId);

    if (!page) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Guide page not found');
    }

    const assignString = (field: keyof IGuidePage) => {
      const value = input[field as string];
      if (typeof value === 'string') {
        (page as any)[field] = value.trim();
      }
    };

    assignString('title');
    assignString('metaTitle');
    assignString('metaDescription');
    assignString('excerpt');
    assignString('bodyMarkdown');
    assignString('sourceSnapshotVersion');
    assignString('rewriteNotes');

    if (Array.isArray(input.keyTakeaways)) {
      page.keyTakeaways = (input.keyTakeaways as unknown[])
        .filter(item => typeof item === 'string')
        .map(item => String(item).trim())
        .filter(Boolean);
    }

    if (Array.isArray(input.faqItems)) {
      page.faqItems = (input.faqItems as Array<Record<string, unknown>>)
        .filter(item => typeof item?.question === 'string' && typeof item?.answer === 'string')
        .map(item => ({
          question: String(item.question).trim(),
          answer: String(item.answer).trim()
        }));
    }

    if (Array.isArray(input.sourceUrls)) {
      page.sourceUrls = (input.sourceUrls as unknown[])
        .filter(item => typeof item === 'string')
        .map(item => String(item).trim())
        .filter(Boolean);
    }

    if (input.practiceBlocks && typeof input.practiceBlocks === 'object') {
      page.practiceBlocks = {
        ...(page.practiceBlocks || {}),
        ...(input.practiceBlocks as Record<string, unknown>)
      };
    }

    if (input.ctaConfig && typeof input.ctaConfig === 'object') {
      page.ctaConfig = input.ctaConfig as any;
    }

    if (typeof input.noindex === 'boolean') {
      page.noindex = input.noindex;
    }

    if (typeof input.priority === 'number') {
      page.priority = Math.max(0, Math.min(1, input.priority));
    }

    if (typeof input.changeFrequency === 'string' && ['daily', 'weekly', 'monthly'].includes(input.changeFrequency)) {
      page.changeFrequency = input.changeFrequency as IGuidePage['changeFrequency'];
    }

    if (typeof input.state === 'string' && GUIDE_STATES.includes(input.state as GuideState)) {
      page.state = input.state as GuideState;
    }

    if (typeof input.contentRisk === 'string' && ['low', 'medium', 'high'].includes(input.contentRisk)) {
      page.contentRisk = input.contentRisk as IGuidePage['contentRisk'];
    }

    page.authorId = actor;

    const qa = this.scoreGuideQa(page);
    this.applyQaToPage(page, qa);

    await page.save();

    await GuideQaReportModel.create({
      guidePageId: page._id,
      citationCoverageScore: qa.citationCoverageScore,
      duplicationScore: qa.duplicationScore,
      readabilityScore: qa.readabilityScore,
      linkValidationPassed: qa.linkValidationPassed,
      schemaValidationPassed: qa.schemaValidationPassed,
      passed: qa.qaPassed,
      warnings: qa.warnings,
      createdByUserId: actor
    });

    return {
      page: this.toGuideDetail(page)
    };
  }

  public async reviewGuidePage(
    pageId: string,
    input: { decision: 'approved' | 'rejected' | 'changes_requested'; notes?: string },
    actorUserId: string
  ) {
    const actor = this.toObjectId(actorUserId, 'Invalid actor user id');
    const page = await GuidePageModel.findById(pageId);

    if (!page) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Guide page not found');
    }

    page.reviewerId = actor;
    page.lastReviewedAt = new Date();

    if (input.decision === 'approved') {
      page.state = page.qaPassed ? 'qa_passed' : 'review';
    } else if (input.decision === 'changes_requested') {
      page.state = 'drafting';
    } else {
      page.state = 'mapped';
    }

    if (input.notes?.trim()) {
      page.rewriteNotes = [page.rewriteNotes, `Review note: ${input.notes.trim()}`].filter(Boolean).join('\n');
    }

    await page.save();

    return {
      page: this.toGuideDetail(page)
    };
  }

  public async publishGuidePage(pageId: string, actorUserId: string) {
    const actor = this.toObjectId(actorUserId, 'Invalid actor user id');
    const page = await GuidePageModel.findById(pageId);

    if (!page) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Guide page not found');
    }

    const qa = this.scoreGuideQa(page);
    this.applyQaToPage(page, qa);

    const blockingErrors: string[] = [];

    if (!page.bodyMarkdown?.trim()) {
      blockingErrors.push('Guide body markdown is required before publish');
    }
    if (!page.practiceBlocks?.quickAnswer?.trim()) {
      blockingErrors.push('Quick Answer block is required before publish');
    }
    if (!Array.isArray(page.practiceBlocks?.commonMistakes) || page.practiceBlocks.commonMistakes.length === 0) {
      blockingErrors.push('Common Mistakes block is required before publish');
    }
    if (!Array.isArray(page.practiceBlocks?.stepByStepMethod) || page.practiceBlocks.stepByStepMethod.length === 0) {
      blockingErrors.push('Step-by-Step Method block is required before publish');
    }
    if (!page.practiceBlocks?.timedPracticeDrill?.trim()) {
      blockingErrors.push('Timed Practice Drill block is required before publish');
    }
    if (!Array.isArray(page.practiceBlocks?.selfCheckChecklist) || page.practiceBlocks.selfCheckChecklist.length === 0) {
      blockingErrors.push('Self-check Checklist block is required before publish');
    }
    if (page.duplicationScore !== undefined && page.duplicationScore > 0.28) {
      blockingErrors.push('Duplication score exceeds threshold');
    }
    if (page.citationCoverageScore !== undefined && page.citationCoverageScore < 0.5) {
      blockingErrors.push('Citation coverage score below threshold');
    }
    if (!page.linkValidationPassed) {
      blockingErrors.push('Link validation must pass before publish');
    }
    if (!page.schemaValidationPassed) {
      blockingErrors.push('Schema validation must pass before publish');
    }

    if (blockingErrors.length > 0) {
      throw new CSError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        CODES.InvalidBody,
        `Guide page failed QA publish gates: ${blockingErrors.join('; ')}`
      );
    }

    page.state = 'published';
    page.qaPassed = true;
    page.publishedAt = new Date();
    page.lastReviewedAt = new Date();
    page.reviewerId = actor;

    await page.save();

    await GuideQaReportModel.create({
      guidePageId: page._id,
      citationCoverageScore: page.citationCoverageScore || 0,
      duplicationScore: page.duplicationScore || 0,
      readabilityScore: page.readabilityScore || 0,
      linkValidationPassed: !!page.linkValidationPassed,
      schemaValidationPassed: !!page.schemaValidationPassed,
      passed: true,
      warnings: [],
      createdByUserId: actor
    });

    return {
      page: this.toGuideDetail(page)
    };
  }

  public async enqueueGuideRefreshQueue(input: { module?: GuideModule; limit?: number }, actorUserId: string) {
    const actor = this.toObjectId(actorUserId, 'Invalid actor user id');
    const { limit } = this.resolvePagination(input.limit, 0, 100, 0, 500);

    const filter: Record<string, unknown> = {
      state: 'published'
    };

    if (input.module) {
      filter.module = input.module;
    }

    const staleBefore = new Date(Date.now() - 1000 * 60 * 60 * 24 * 45);
    filter.$or = [{ lastReviewedAt: { $exists: false } }, { lastReviewedAt: { $lte: staleBefore } }];

    const rows = await GuidePageModel.find(filter).sort({ lastReviewedAt: 1, updatedAt: 1 }).limit(limit).lean();

    const ids = rows.map(row => row._id.toString());

    if (ids.length) {
      await GuidePageModel.updateMany(
        { _id: { $in: ids } },
        {
          $set: {
            state: 'review'
          }
        }
      );
    }

    const job = await GuideImportJobModel.create({
      type: 'refresh_queue',
      status: 'completed',
      payload: {
        module: input.module || 'all',
        limit
      },
      result: {
        queued: ids.length,
        pageIds: ids
      },
      createdByUserId: actor,
      startedAt: new Date(),
      finishedAt: new Date()
    });

    return {
      jobId: job._id.toString(),
      queued: ids.length,
      pageIds: ids
    };
  }

  private isSupabaseReadMode(): boolean {
    return env.db.readMode === 'supabase';
  }

  private normalizeGuideDocumentRow(row: { id: string; data: Record<string, any>; created_at?: string; updated_at?: string }) {
    const data = row.data || {};

    const toDate = (value: unknown, fallback?: string) => {
      const raw = typeof value === 'string' && value ? value : fallback;
      if (!raw) return undefined;
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    };

    return {
      _id: row.id,
      slug: data.slug || '',
      canonicalPath: normalizeGuideCanonicalPath(data.canonicalPath || '/ielts'),
      title: data.title || '',
      excerpt: data.excerpt,
      module: data.module as GuideModule,
      pageType: data.pageType as GuidePageType,
      contentClass: data.contentClass as GuideContentClass,
      templateType: data.templateType as GuideTemplateType,
      depth: Number.isFinite(Number(data.depth)) ? Number(data.depth) : 1,
      order: Number.isFinite(Number(data.order)) ? Number(data.order) : 100,
      parentId: data.parentId,
      state: data.state as GuideState,
      qaPassed: Boolean(data.qaPassed),
      qaScore: Number.isFinite(Number(data.qaScore)) ? Number(data.qaScore) : 0,
      publishedAt: toDate(data.publishedAt),
      lastReviewedAt: toDate(data.lastReviewedAt),
      updatedAt: toDate(data.updatedAt, row.updated_at),
      createdAt: toDate(data.createdAt, row.created_at),
      legacySlugs: Array.isArray(data.legacySlugs) ? data.legacySlugs : [],
      track: data.track,
      intent: data.intent,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      bodyMarkdown: data.bodyMarkdown,
      keyTakeaways: Array.isArray(data.keyTakeaways) ? data.keyTakeaways : [],
      faqItems: Array.isArray(data.faqItems) ? data.faqItems : [],
      practiceBlocks: data.practiceBlocks || {},
      ctaConfig: data.ctaConfig || {},
      contentRisk: data.contentRisk,
      citationCoverageScore: Number.isFinite(Number(data.citationCoverageScore)) ? Number(data.citationCoverageScore) : 0,
      duplicationScore: Number.isFinite(Number(data.duplicationScore)) ? Number(data.duplicationScore) : 0,
      readabilityScore: Number.isFinite(Number(data.readabilityScore)) ? Number(data.readabilityScore) : 0,
      linkValidationPassed: Boolean(data.linkValidationPassed),
      schemaValidationPassed: Boolean(data.schemaValidationPassed),
      sourceUrls: Array.isArray(data.sourceUrls) ? data.sourceUrls : [],
      sourceSnapshotVersion: data.sourceSnapshotVersion,
      rewriteNotes: data.rewriteNotes,
      noindex: Boolean(data.noindex),
      changeFrequency: data.changeFrequency,
      priority: Number.isFinite(Number(data.priority)) ? Number(data.priority) : undefined
    };
  }

  private appendPublicGuideVisibilityClauses(clauses: string[], params: Array<string | string[]>, enforceNoindex: boolean) {
    if (enforceNoindex) {
      clauses.push(`coalesce((data->>'noindex')::boolean, false) = false`);
    }

    if (this.shouldExposeDraftGuides()) {
      const states = ['mapped', 'outline_ready', 'drafting', 'review', 'qa_passed', 'published'];
      params.push(states);
      clauses.push(`coalesce(data->>'state', '') = any($${params.length}::text[])`);
      return;
    }

    clauses.push(`coalesce(data->>'state', '') = 'published'`);
  }

  private async fetchPublicGuideRows(input: {
    module?: GuideModule;
    contentClass?: GuideContentClass;
    pageType?: GuidePageType;
    q?: string;
    limit: number;
    offset: number;
    enforceNoindex: boolean;
    sortByLatest?: boolean;
    excludeId?: string;
  }): Promise<any[]> {
    if (!this.isSupabaseReadMode()) {
      const filter: Record<string, unknown> = this.buildPublicGuideFilter({ enforceNoindex: input.enforceNoindex });
      if (input.module) filter.module = input.module;
      if (input.contentClass) filter.contentClass = input.contentClass;
      if (input.pageType) filter.pageType = input.pageType;
      if (input.excludeId) {
        filter._id = { $ne: this.toObjectId(input.excludeId, 'Invalid guide id') };
      }
      const safeQuery = (input.q || '').trim();
      if (safeQuery) {
        const regex = new RegExp(escapeRegex(safeQuery), 'i');
        filter.$or = [{ title: regex }, { excerpt: regex }, { bodyMarkdown: regex }];
      }

      const sort = input.sortByLatest ? { updatedAt: -1, publishedAt: -1 } : { depth: 1, order: 1, title: 1 };
      return GuidePageModel.find(filter).sort(sort).skip(input.offset).limit(input.limit).lean();
    }

    const clauses: string[] = [];
    const params: Array<string | string[]> = [];
    this.appendPublicGuideVisibilityClauses(clauses, params, input.enforceNoindex);

    if (input.module) {
      params.push(input.module);
      clauses.push(`coalesce(data->>'module', '') = $${params.length}`);
    }
    if (input.contentClass) {
      params.push(input.contentClass);
      clauses.push(`coalesce(data->>'contentClass', '') = $${params.length}`);
    }
    if (input.pageType) {
      params.push(input.pageType);
      clauses.push(`coalesce(data->>'pageType', '') = $${params.length}`);
    }
    if (input.excludeId) {
      params.push(input.excludeId);
      clauses.push(`id <> $${params.length}`);
    }

    const safeQuery = (input.q || '').trim();
    if (safeQuery) {
      params.push(`%${safeQuery.toLowerCase()}%`);
      const idx = params.length;
      clauses.push(
        `(lower(coalesce(data->>'title','')) like $${idx} or lower(coalesce(data->>'excerpt','')) like $${idx} or lower(coalesce(data->>'bodyMarkdown','')) like $${idx})`
      );
    }

    const whereSql = clauses.length ? `where ${clauses.join(' and ')}` : '';
    const orderSql = input.sortByLatest
      ? `order by coalesce(data->>'updatedAt', data->>'publishedAt', '') desc`
      : `order by coalesce((data->>'depth')::int, 1) asc, coalesce((data->>'order')::int, 100) asc, lower(coalesce(data->>'title','')) asc`;

    params.push(String(input.limit));
    const limitIdx = params.length;
    params.push(String(input.offset));
    const offsetIdx = params.length;

    const pool = getPgPool();
    const result = await pool.query(
      `select id, data, created_at, updated_at from "guide_pages" ${whereSql} ${orderSql} limit $${limitIdx}::int offset $${offsetIdx}::int`,
      params
    );

    return result.rows.map(row => this.normalizeGuideDocumentRow(row));
  }

  private async countPublicGuideRows(input: {
    module?: GuideModule;
    contentClass?: GuideContentClass;
    pageType?: GuidePageType;
    q?: string;
    enforceNoindex: boolean;
  }): Promise<number> {
    if (!this.isSupabaseReadMode()) {
      const filter: Record<string, unknown> = this.buildPublicGuideFilter({ enforceNoindex: input.enforceNoindex });
      if (input.module) filter.module = input.module;
      if (input.contentClass) filter.contentClass = input.contentClass;
      if (input.pageType) filter.pageType = input.pageType;

      const safeQuery = (input.q || '').trim();
      if (safeQuery) {
        const regex = new RegExp(escapeRegex(safeQuery), 'i');
        filter.$or = [{ title: regex }, { excerpt: regex }, { bodyMarkdown: regex }];
      }

      return GuidePageModel.countDocuments(filter);
    }

    const clauses: string[] = [];
    const params: Array<string | string[]> = [];
    this.appendPublicGuideVisibilityClauses(clauses, params, input.enforceNoindex);

    if (input.module) {
      params.push(input.module);
      clauses.push(`coalesce(data->>'module', '') = $${params.length}`);
    }
    if (input.contentClass) {
      params.push(input.contentClass);
      clauses.push(`coalesce(data->>'contentClass', '') = $${params.length}`);
    }
    if (input.pageType) {
      params.push(input.pageType);
      clauses.push(`coalesce(data->>'pageType', '') = $${params.length}`);
    }

    const safeQuery = (input.q || '').trim();
    if (safeQuery) {
      params.push(`%${safeQuery.toLowerCase()}%`);
      const idx = params.length;
      clauses.push(
        `(lower(coalesce(data->>'title','')) like $${idx} or lower(coalesce(data->>'excerpt','')) like $${idx} or lower(coalesce(data->>'bodyMarkdown','')) like $${idx})`
      );
    }

    const whereSql = clauses.length ? `where ${clauses.join(' and ')}` : '';
    const pool = getPgPool();
    const result = await pool.query(`select count(*)::int as count from "guide_pages" ${whereSql}`, params);
    return Number(result.rows?.[0]?.count || 0);
  }

  private async fetchPublicGuidePageRow(input: { normalizedPath: string; slugCandidate?: string }): Promise<any | null> {
    if (!this.isSupabaseReadMode()) {
      const visibilityFilter = this.buildPublicGuideFilter();
      let row = await GuidePageModel.findOne({
        ...visibilityFilter,
        canonicalPath: input.normalizedPath
      }).lean();

      if (!row && input.slugCandidate) {
        row = await GuidePageModel.findOne({
          ...visibilityFilter,
          legacySlugs: input.slugCandidate
        }).lean();
      }

      return row || null;
    }

    const pool = getPgPool();
    const baseClauses: string[] = [];
    const baseParams: Array<string | string[]> = [];
    this.appendPublicGuideVisibilityClauses(baseClauses, baseParams, false);

    const pathParams = [...baseParams, input.normalizedPath];
    const pathClauses = [...baseClauses, `coalesce(data->>'canonicalPath', '') = $${pathParams.length}`];
    const byPath = await pool.query(
      `select id, data, created_at, updated_at from "guide_pages" where ${pathClauses.join(' and ')} limit 1`,
      pathParams
    );
    if (byPath.rows.length > 0) {
      return this.normalizeGuideDocumentRow(byPath.rows[0]);
    }

    if (!input.slugCandidate) {
      return null;
    }

    const slugParams = [...baseParams, input.slugCandidate];
    const slugClauses = [...baseClauses, `coalesce(data->'legacySlugs', '[]'::jsonb) ? $${slugParams.length}`];
    const bySlug = await pool.query(
      `select id, data, created_at, updated_at from "guide_pages" where ${slugClauses.join(' and ')} limit 1`,
      slugParams
    );
    if (bySlug.rows.length > 0) {
      return this.normalizeGuideDocumentRow(bySlug.rows[0]);
    }

    return null;
  }

  private async fetchGuideRowById(id: string): Promise<any | null> {
    if (!this.isSupabaseReadMode()) {
      const row = await GuidePageModel.findById(id).lean();
      return row || null;
    }

    const pool = getPgPool();
    const result = await pool.query(`select id, data, created_at, updated_at from "guide_pages" where id = $1 limit 1`, [id]);
    if (!result.rows.length) {
      return null;
    }
    return this.normalizeGuideDocumentRow(result.rows[0]);
  }

  private toGuideSummary(row: any) {
    return {
      id: row._id.toString(),
      slug: row.slug,
      canonicalPath: row.canonicalPath,
      title: row.title,
      excerpt: row.excerpt,
      module: row.module,
      pageType: row.pageType,
      contentClass: row.contentClass,
      state: row.state,
      qaPassed: row.qaPassed,
      qaScore: row.qaScore,
      publishedAt: row.publishedAt?.toISOString(),
      lastReviewedAt: row.lastReviewedAt?.toISOString(),
      updatedAt: row.updatedAt?.toISOString()
    };
  }

  private toGuideDetail(row: any) {
    const base = this.toGuideSummary(row);
    return {
      ...base,
      depth: row.depth,
      order: row.order,
      parentId: row.parentId?.toString(),
      legacySlugs: row.legacySlugs || [],
      track: row.track,
      intent: row.intent,
      templateType: row.templateType,
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      bodyMarkdown: row.bodyMarkdown,
      keyTakeaways: row.keyTakeaways || [],
      faqItems: row.faqItems || [],
      practiceBlocks: row.practiceBlocks || {},
      ctaConfig: row.ctaConfig || {},
      contentRisk: row.contentRisk,
      citationCoverageScore: row.citationCoverageScore,
      duplicationScore: row.duplicationScore,
      readabilityScore: row.readabilityScore,
      linkValidationPassed: row.linkValidationPassed,
      schemaValidationPassed: row.schemaValidationPassed,
      sourceUrls: row.sourceUrls || [],
      sourceSnapshotVersion: row.sourceSnapshotVersion,
      rewriteNotes: row.rewriteNotes,
      noindex: row.noindex,
      changeFrequency: row.changeFrequency,
      priority: row.priority,
      createdAt: row.createdAt?.toISOString()
    };
  }

  private async findRelatedGuides(guideId: string, module: GuideModule, limit: number) {
    const rows = await this.fetchPublicGuideRows({
      module,
      limit,
      offset: 0,
      enforceNoindex: true,
      sortByLatest: true,
      excludeId: guideId
    });

    return rows.map(row => this.toGuideSummary(row));
  }

  private resolvePagination(limit?: number, offset?: number, defaultLimit = 20, defaultOffset = 0, maxLimit = 100): Pagination {
    const finalLimit = Number.isFinite(limit) ? Math.max(1, Math.min(maxLimit, Number(limit))) : defaultLimit;
    const finalOffset = Number.isFinite(offset) ? Math.max(0, Number(offset)) : defaultOffset;

    return {
      limit: finalLimit,
      offset: finalOffset
    };
  }

  private parentPath(canonicalPath: string): string | null {
    const parts = canonicalPath.split('/').filter(Boolean);
    if (parts.length <= 2) {
      return '/ielts';
    }

    const parent = `/${parts.slice(0, parts.length - 1).join('/')}`;
    return parent === canonicalPath ? null : parent;
  }

  private toObjectId(value: string, message = 'Invalid id') {
    if (!Types.ObjectId.isValid(value)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, message);
    }
    return new Types.ObjectId(value);
  }

  private async downloadSitemap(url: string): Promise<string> {
    const timeoutMsRaw = Number(process.env.GUIDE_IMPORT_HTTP_TIMEOUT_MS || 20000);
    const retriesRaw = Number(process.env.GUIDE_IMPORT_HTTP_RETRIES || 3);
    const timeoutMs = Number.isFinite(timeoutMsRaw) ? Math.max(3000, Math.min(120000, timeoutMsRaw)) : 20000;
    const retries = Number.isFinite(retriesRaw) ? Math.max(1, Math.min(6, retriesRaw)) : 3;

    let lastErrorMessage = 'unknown error';

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Spokio-Guide-Importer/1.0'
          },
          signal: controller.signal
        });

        if (!response.ok) {
          lastErrorMessage = `HTTP ${response.status}`;
        } else {
          return await response.text();
        }
      } catch (error: any) {
        lastErrorMessage = error?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : error?.message || 'network error';
      } finally {
        clearTimeout(timer);
      }

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 300 * attempt));
      }
    }

    throw new CSError(
      HTTP_STATUS_CODES.BAD_REQUEST,
      CODES.InvalidBody,
      `Failed to download sitemap ${url}: ${lastErrorMessage}`
    );
  }

  private extractSitemapEntries(payload: string): Array<{ url: string; lastmod?: string }> {
    const entries: Array<{ url: string; lastmod?: string }> = [];

    const xmlRegex = /<url>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?(?:<lastmod>(.*?)<\/lastmod>)?[\s\S]*?<\/url>/g;
    let xmlMatch = xmlRegex.exec(payload);
    while (xmlMatch) {
      const url = xmlMatch[1]?.trim();
      if (url) {
        entries.push({
          url,
          lastmod: xmlMatch[2]?.trim()
        });
      }
      xmlMatch = xmlRegex.exec(payload);
    }

    if (entries.length > 0) {
      return entries;
    }

    const hrefRegex = /href=["']([^"']+)["']/g;
    let hrefMatch = hrefRegex.exec(payload);
    while (hrefMatch) {
      const url = hrefMatch[1]?.trim();
      if (url?.startsWith('http')) {
        entries.push({ url });
      }
      hrefMatch = hrefRegex.exec(payload);
    }

    if (entries.length > 0) {
      return entries;
    }

    const genericUrlRegex = /https?:\/\/[^\s<"']+/g;
    const discovered = payload.match(genericUrlRegex) || [];
    discovered.forEach(url => {
      entries.push({ url: url.trim() });
    });

    return entries;
  }

  private inferIntent(sourceUrl: string): 'informational' | 'commercial' | 'transactional' | 'navigational' {
    const safe = sourceUrl.toLowerCase();
    if (safe.includes('buy') || safe.includes('price') || safe.includes('plan')) return 'transactional';
    if (safe.includes('offer') || safe.includes('membership')) return 'commercial';
    if (safe.includes('faq') || safe.includes('category')) return 'navigational';
    return 'informational';
  }

  private priorityForModule(module: GuideModule): number {
    const index = GUIDE_MODULES.indexOf(module);
    if (index === -1) return 999;
    return index + 1;
  }

  private moduleDisplayName(module: GuideModule): string {
    const labelMap: Record<GuideModule, string> = {
      speaking: 'Speaking',
      writing: 'Writing',
      reading: 'Reading',
      listening: 'Listening',
      vocabulary: 'Vocabulary',
      'exam-strategy': 'Exam Strategy',
      'band-scores': 'Band Scores',
      resources: 'Resources',
      faq: 'FAQ',
      updates: 'Updates',
      offers: 'Offers',
      membership: 'Membership'
    };

    return labelMap[module] || module;
  }

  private titleFromSlug(slug: string): string {
    return slug
      .split('-')
      .filter(Boolean)
      .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join(' ')
      .trim();
  }

  private shouldExposeDraftGuides(): boolean {
    const explicit = (process.env.GUIDE_PUBLIC_INCLUDE_DRAFTS || '').trim().toLowerCase();
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    return process.env.NODE_ENV !== 'production';
  }

  private buildPublicGuideFilter(options?: { enforceNoindex?: boolean }): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (options?.enforceNoindex) {
      filter.noindex = false;
    }

    if (this.shouldExposeDraftGuides()) {
      filter.state = {
        $in: ['mapped', 'outline_ready', 'drafting', 'review', 'qa_passed', 'published']
      };
      return filter;
    }

    filter.state = 'published';
    filter.publishedAt = { $lte: new Date() };
    return filter;
  }

  private buildSeedGuideContent(input: {
    sourceUrl: string;
    title: string;
    module: GuideModule;
    pageType: GuidePageType;
    contentClass: GuideContentClass;
  }) {
    const moduleLabel = this.moduleDisplayName(input.module);
    const focusText = `${moduleLabel} strategy`;
    const sourceHost = (() => {
      try {
        return new URL(input.sourceUrl).hostname.replace(/^www\./, '');
      } catch {
        return 'source';
      }
    })();

    const title = input.title || `${moduleLabel} Guide`;
    const excerpt = `Practice-first ${moduleLabel.toLowerCase()} guide for ${title.toLowerCase()} with structured drills, mistakes to avoid, and source-attributed references.`;
    const metaDescription = `Spokio ${moduleLabel.toLowerCase()} route for ${title.toLowerCase()}: quick answer, mistakes, timed drill, and action checklist.`;

    const keyTakeaways = [
      `Use a repeatable ${focusText.toLowerCase()} routine instead of random practice.`,
      `Track one measurable target per session for ${moduleLabel.toLowerCase()}.`,
      'Move to the next linked route immediately after completing the drill.'
    ];

    const stepByStepMethod = [
      `Review the ${moduleLabel.toLowerCase()} prompt objective and scoring target.`,
      'Run one timed exercise under exam-like constraints.',
      'Audit errors and convert them into a concrete next action.'
    ];

    const practiceBlocks = {
      quickAnswer: `${title} improves fastest when you combine timed execution, explicit self-review, and one defined next route per session.`,
      commonMistakes: [
        'Starting practice without a scoring target.',
        'Skipping post-drill error analysis.',
        'Repeating the same task type without increasing difficulty.'
      ],
      stepByStepMethod,
      timedPracticeDrill: '25-minute drill: 5 minutes plan, 15 minutes execute, 5 minutes score against rubric and capture one correction.',
      selfCheckChecklist: [
        'I completed one full timed drill.',
        'I logged at least one correction to apply next session.',
        'I selected the next guide route before leaving this page.'
      ]
    };

    const faqItems = [
      {
        question: `How should I use this ${moduleLabel.toLowerCase()} route?`,
        answer: `Start with the quick answer, execute the timed drill, and follow the next-action route to keep momentum.`
      },
      {
        question: 'Where is the source reference for this guide?',
        answer: `See the source reference in this guide body: ${input.sourceUrl}`
      }
    ];

    const bodyMarkdown = [
      `# ${title}`,
      '',
      '## Quick Answer',
      `${practiceBlocks.quickAnswer}`,
      '',
      '## What To Practice',
      ...keyTakeaways.map(item => `- ${item}`),
      '',
      '## Step-by-Step Method',
      ...stepByStepMethod.map((item, idx) => `${idx + 1}. ${item}`),
      '',
      '## Source-attributed reference',
      `- Original topic source (${sourceHost}): ${input.sourceUrl}`,
      '',
      '## Next Action',
      '- Complete one timed drill now.',
      '- Review weak points and continue to the next related route.'
    ].join('\n');

    return {
      title,
      metaTitle: `${title} | Spokio IELTS`,
      metaDescription,
      excerpt,
      bodyMarkdown,
      keyTakeaways,
      faqItems,
      practiceBlocks,
      ctaConfig: {
        primary: {
          label: 'Start Free',
          href: '/register'
        },
        secondary: {
          label: 'Compare Plans',
          href: '/pricing'
        }
      }
    };
  }

  private scoreGuideQa(page: Partial<IGuidePage>): GuideQaScore {
    const body = String(page.bodyMarkdown || '');
    const sourceUrls = Array.isArray(page.sourceUrls) ? page.sourceUrls : [];

    const linksInBody = this.extractLinks(body);
    const citationCoverageScore = Math.max(0, Math.min(1, sourceUrls.length > 0 ? linksInBody.length / sourceUrls.length : 0));
    const duplicationScore = this.duplicationScore(body);
    const readabilityScore = this.readabilityScore(body);
    const linkValidationPassed = linksInBody.every(link => link.startsWith('https://'));
    const schemaValidationPassed = Boolean(page.title && (page.metaDescription || page.excerpt));

    const warnings: string[] = [];
    if (citationCoverageScore < 0.5) warnings.push('Citation coverage below required threshold');
    if (duplicationScore > 0.28) warnings.push('Duplication score above allowed threshold');
    if (readabilityScore < 0.55) warnings.push('Readability score below preferred threshold');
    if (!linkValidationPassed) warnings.push('Some links are invalid');
    if (!schemaValidationPassed) warnings.push('Missing title/meta/excerpt schema requirements');

    const qaPassed =
      citationCoverageScore >= 0.5 &&
      duplicationScore <= 0.28 &&
      readabilityScore >= 0.45 &&
      linkValidationPassed &&
      schemaValidationPassed;

    const qaScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          citationCoverageScore * 30 +
            (1 - duplicationScore) * 30 +
            readabilityScore * 20 +
            (linkValidationPassed ? 10 : 0) +
            (schemaValidationPassed ? 10 : 0)
        )
      )
    );

    return {
      qaPassed,
      qaScore,
      citationCoverageScore,
      duplicationScore,
      readabilityScore,
      linkValidationPassed,
      schemaValidationPassed,
      warnings
    };
  }

  private extractLinks(content: string): string[] {
    const regex = /https?:\/\/[^\s)\]}"'>]+/g;
    return Array.from(new Set(content.match(regex) || []));
  }

  private duplicationScore(content: string): number {
    if (!content.trim()) return 1;
    const sentences = content
      .split(/[.!?]/)
      .map(item => item.trim().toLowerCase())
      .filter(Boolean);

    if (sentences.length === 0) return 1;

    const unique = new Set(sentences);
    return Math.max(0, Math.min(1, 1 - unique.size / sentences.length));
  }

  private readabilityScore(content: string): number {
    const words = content
      .replace(/[#>*_`\-\n]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    if (!words.length) return 0;

    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const ideal = 5.2;
    const distance = Math.abs(avgWordLength - ideal);

    return Math.max(0, Math.min(1, 1 - distance / 6));
  }

  private applyQaToPage(page: any, qa: GuideQaScore) {
    page.qaPassed = qa.qaPassed;
    page.qaScore = qa.qaScore;
    page.citationCoverageScore = qa.citationCoverageScore;
    page.duplicationScore = qa.duplicationScore;
    page.readabilityScore = qa.readabilityScore;
    page.linkValidationPassed = qa.linkValidationPassed;
    page.schemaValidationPassed = qa.schemaValidationPassed;
  }
}

// Keep exported so these lists are easy to reuse by tests and API docs.
export const GUIDE_CONSTANTS = {
  GUIDE_MODULES,
  GUIDE_CONTENT_CLASSES,
  GUIDE_PAGE_TYPES,
  GUIDE_TEMPLATE_TYPES,
  GUIDE_STATES
} as const;
