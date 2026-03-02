import 'reflect-metadata';
import dotenv from 'dotenv';
import { Client } from 'pg';

import { generateMongoStyleId } from '@lib/db/id';
import {
  inferGuideContentClass,
  inferGuideDestinationPath,
  inferGuideModuleFromSourceUrl,
  inferGuidePageType,
  inferGuideTemplateType,
  slugifyGuideText
} from '@services/GuideService';

dotenv.config();

type SitemapEntry = {
  sourceUrl: string;
  sourceType: 'page' | 'post' | 'misc';
  lastmod?: string;
};

type ExistingRow = {
  id: string;
  data: Record<string, any>;
  createdAt: string;
};

const DEFAULT_SITEMAPS = [
  'https://ieltsliz.com/page-sitemap.html',
  'https://ieltsliz.com/post-sitemap.html',
  'https://ieltsliz.com/sitemap-misc.html'
];

const DEFAULT_ACTOR_ID = '68e7cfc514d5a19ed89792b7';

const parseSitemaps = () => {
  const raw = (process.env.GUIDE_IMPORT_SITEMAPS || '').trim();
  if (!raw) return DEFAULT_SITEMAPS;

  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
};

const inferSourceType = (sitemapUrl: string): 'page' | 'post' | 'misc' => {
  const lower = sitemapUrl.toLowerCase();
  if (lower.includes('page-sitemap')) return 'page';
  if (lower.includes('misc')) return 'misc';
  return 'post';
};

const normalizeTitleFromPath = (path: string) => {
  const slug = path.split('/').filter(Boolean).pop() || 'guide';
  return slug
    .split('-')
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
};

const inferIntent = (sourceUrl: string): 'informational' | 'commercial' | 'transactional' | 'navigational' => {
  const safe = sourceUrl.toLowerCase();

  if (
    safe.includes('price') ||
    safe.includes('cost') ||
    safe.includes('buy') ||
    safe.includes('plan') ||
    safe.includes('subscription') ||
    safe.includes('premium')
  ) {
    return 'transactional';
  }

  if (
    safe.includes('best') ||
    safe.includes('vs') ||
    safe.includes('comparison') ||
    safe.includes('guide') ||
    safe.includes('tips') ||
    safe.includes('how-to')
  ) {
    return 'commercial';
  }

  if (safe.includes('about') || safe.includes('contact') || safe.includes('faq') || safe.includes('policy')) {
    return 'navigational';
  }

  return 'informational';
};

const priorityForModule = (module: string) => {
  const order: Record<string, number> = {
    speaking: 10,
    writing: 20,
    reading: 30,
    listening: 40,
    vocabulary: 50,
    'exam-strategy': 60,
    'band-scores': 70,
    resources: 80,
    faq: 90,
    updates: 100,
    offers: 110,
    membership: 120
  };

  return order[module] ?? 999;
};

const inferPublishWaveByModule = (module: string): 1 | 2 | 3 => {
  if (['speaking', 'writing', 'reading', 'listening', 'vocabulary', 'exam-strategy'].includes(module)) return 1;
  if (['band-scores', 'resources', 'faq'].includes(module)) return 2;
  return 3;
};

const dedupeStrings = (items: string[]) => Array.from(new Set(items.map(item => item.trim()).filter(Boolean)));

const buildSeedContent = (params: { sourceUrl: string; destinationPath: string; module: string; title: string }) => {
  const { sourceUrl, destinationPath, module, title } = params;

  return {
    title,
    metaTitle: `${title} | Spokio IELTS Guide`,
    metaDescription: `Practice-first ${module.replace('-', ' ')} guide for IELTS learners. Includes common mistakes, drills, and next actions.`,
    excerpt: `This route maps IELTS strategy for ${title.toLowerCase()} with practical steps and drill structure.`,
    bodyMarkdown: [
      `# ${title}`,
      '',
      '## What this page covers',
      '- Core strategy summary in Spokio voice (rewritten).',
      '- Practice-first block sequence.',
      '- Next route and conversion-aware CTA path.',
      '',
      '## Source reference',
      `- Original source URL captured for editorial rewrite: ${sourceUrl}`,
      '',
      '## Rewrite policy',
      '- This page is a structured outline and must be rewritten by a human editor before publication.'
    ].join('\n'),
    keyTakeaways: [
      `Prioritize one measurable ${module.replace('-', ' ')} objective per practice cycle.`,
      'Use timed drills and explicit self-check criteria.',
      'Promote next-route continuity instead of isolated tips.'
    ],
    faqItems: [
      {
        question: `How should I use this ${module.replace('-', ' ')} guide?`,
        answer: 'Start with the quick answer, run the timed drill, then follow the next-route recommendation.'
      }
    ],
    practiceBlocks: {
      quickAnswer: `${title} improves fastest when you combine timed practice, direct feedback loops, and weekly review checkpoints.`,
      commonMistakes: ['Skipping timed practice', 'Ignoring scoring criteria', 'Not tracking mistakes between sessions'],
      stepByStepMethod: [
        'Set one measurable score target.',
        'Run a timed drill using exam constraints.',
        'Review errors and set the next route immediately.'
      ],
      timedPracticeDrill: 'Complete one 20-minute focused drill and self-evaluate before moving to the next route.',
      selfCheckChecklist: [
        'I completed the route under time pressure.',
        'I logged 2-3 actionable mistakes.',
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
    canonicalPath: destinationPath
  };
};

const extractSitemapEntries = (payload: string): Array<{ url: string; lastmod?: string }> => {
  const entries: Array<{ url: string; lastmod?: string }> = [];

  const xmlRegex = /<url>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?(?:<lastmod>(.*?)<\/lastmod>)?[\s\S]*?<\/url>/g;
  let xmlMatch = xmlRegex.exec(payload);
  while (xmlMatch) {
    const url = xmlMatch[1]?.trim();
    if (url) {
      entries.push({ url, lastmod: xmlMatch[2]?.trim() });
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
  discovered.forEach(url => entries.push({ url: url.trim() }));
  return entries;
};

const fetchSitemap = async (url: string): Promise<string> => {
  const timeoutMs = Number(process.env.GUIDE_IMPORT_HTTP_TIMEOUT_MS || 20000);
  const retries = Number(process.env.GUIDE_IMPORT_HTTP_RETRIES || 3);

  let lastError = 'unknown';

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Spokio-Guide-FastImporter/1.0' },
        signal: controller.signal
      });

      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
      } else {
        return await response.text();
      }
    } catch (error: any) {
      lastError = error?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : error?.message || 'network error';
    } finally {
      clearTimeout(timer);
    }

    if (attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, 300 * attempt));
    }
  }

  throw new Error(`Failed to fetch sitemap ${url}: ${lastError}`);
};

const upsertDocRow = async (client: Client, table: string, id: string, data: Record<string, any>, createdAt?: string) => {
  await client.query(
    `insert into "${table}" (id, data, created_at, updated_at)
     values ($1, $2::jsonb, coalesce($3::timestamptz, now()), now())
     on conflict (id)
     do update set data = excluded.data, updated_at = now()`,
    [id, JSON.stringify(data), createdAt || null]
  );
};

const loadExistingByKey = async (client: Client, table: string, keyField: string): Promise<Map<string, ExistingRow>> => {
  const rows = (
    await client.query(`select id, data, created_at from "${table}"`)
  ).rows as Array<{ id: string; data: Record<string, any>; created_at: Date | string }>;

  const map = new Map<string, ExistingRow>();
  rows.forEach(row => {
    const raw = row.data?.[keyField];
    if (typeof raw !== 'string') return;
    map.set(raw.trim().toLowerCase(), {
      id: row.id,
      data: row.data || {},
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString()
    });
  });
  return map;
};

const buildJobPayload = (params: { sitemaps: string[]; inventoryDate: string; actorId: string }) => ({
  _id: generateMongoStyleId(),
  type: 'sitemap_import',
  status: 'running',
  payload: {
    sitemaps: params.sitemaps,
    inventoryDate: params.inventoryDate
  },
  result: {},
  error: null,
  createdByUserId: params.actorId,
  startedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

const main = async () => {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('SUPABASE_DB_URL or DATABASE_URL is required');
  }

  const actorId = (process.env.GUIDE_IMPORT_ACTOR_ID || DEFAULT_ACTOR_ID).trim();
  const inventoryDate = (process.env.GUIDE_IMPORT_INVENTORY_DATE || new Date().toISOString().slice(0, 10)).trim();
  const sitemaps = parseSitemaps();
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  const discovered = new Map<string, SitemapEntry>();
  for (const sitemapUrl of sitemaps) {
    const sourceType = inferSourceType(sitemapUrl);
    const text = await fetchSitemap(sitemapUrl);
    const entries = extractSitemapEntries(text);
    entries.forEach(entry => {
      if (!entry.url) return;
      discovered.set(entry.url.trim(), {
        sourceUrl: entry.url.trim(),
        sourceType,
        lastmod: entry.lastmod
      });
    });
  }

  const discoveredEntries = Array.from(discovered.values());
  const sourceMapByUrl = await loadExistingByKey(client, 'guide_source_maps', 'sourceUrl');
  const pageByCanonicalPath = await loadExistingByKey(client, 'guide_pages', 'canonicalPath');
  const taxonomyByKey = await loadExistingByKey(client, 'guide_taxonomy_nodes', 'key');

  const runningJobs = (
    await client.query(`select id, data, created_at from "guide_import_jobs" where data->>'status' = 'running'`)
  ).rows as Array<{ id: string; data: Record<string, any>; created_at: Date | string }>;

  for (const stale of runningJobs) {
    const staleData = {
      ...(stale.data || {}),
      status: 'failed',
      error: 'Superseded by fast backfill run',
      finishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await upsertDocRow(
      client,
      'guide_import_jobs',
      stale.id,
      staleData,
      stale.created_at instanceof Date ? stale.created_at.toISOString() : String(stale.created_at)
    );
  }

  const job = buildJobPayload({
    sitemaps,
    inventoryDate,
    actorId
  });
  await upsertDocRow(client, 'guide_import_jobs', job._id, job, job.createdAt);

  let sourceMapsUpserted = 0;
  let pagesCreated = 0;
  let pagesUpdated = 0;
  let failedEntries = 0;
  const failureSamples: string[] = [];

  for (let i = 0; i < discoveredEntries.length; i += 1) {
    const entry = discoveredEntries[i];
    try {
      const module = inferGuideModuleFromSourceUrl(entry.sourceUrl);
      const contentClass = inferGuideContentClass(module);
      const pageType = inferGuidePageType(module);
      const templateType = inferGuideTemplateType(pageType);
      const destinationPath = inferGuideDestinationPath(entry.sourceUrl);
      const destinationSlug = destinationPath.split('/').filter(Boolean).pop() || 'guide';
      const title = normalizeTitleFromPath(destinationPath);
      const intent = inferIntent(entry.sourceUrl);
      const nowIso = new Date().toISOString();

      const sourceMapKey = entry.sourceUrl.toLowerCase();
      const existingSourceMap = sourceMapByUrl.get(sourceMapKey);
      const sourceMapId = existingSourceMap?.id || generateMongoStyleId();
      const sourceMapData = {
        ...(existingSourceMap?.data || {}),
        _id: sourceMapId,
        sourceUrl: entry.sourceUrl,
        sourceType: entry.sourceType,
        lastmod: entry.lastmod,
        moduleGuess: module,
        intent,
        contentClass,
        destinationPath,
        templateType,
        module,
        pageType,
        priority: priorityForModule(module),
        publishWave: inferPublishWaveByModule(module),
        status: 'mapped',
        inventoryDate,
        updatedAt: nowIso,
        createdAt: existingSourceMap?.data?.createdAt || nowIso
      };
      await upsertDocRow(client, 'guide_source_maps', sourceMapId, sourceMapData, existingSourceMap?.createdAt || sourceMapData.createdAt);
      sourceMapByUrl.set(sourceMapKey, { id: sourceMapId, data: sourceMapData, createdAt: existingSourceMap?.createdAt || sourceMapData.createdAt });
      sourceMapsUpserted += 1;

      const moduleKey = String(module).toLowerCase();
      const existingTaxonomy = taxonomyByKey.get(moduleKey);
      if (!existingTaxonomy) {
        const taxonomyId = generateMongoStyleId();
        const taxonomyData = {
          _id: taxonomyId,
          key: module,
          name: module
            .split('-')
            .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
            .join(' '),
          slug: module,
          module,
          contentClass,
          order: priorityForModule(module),
          depth: 1,
          active: true,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        await upsertDocRow(client, 'guide_taxonomy_nodes', taxonomyId, taxonomyData, taxonomyData.createdAt);
        taxonomyByKey.set(moduleKey, { id: taxonomyId, data: taxonomyData, createdAt: taxonomyData.createdAt });
      }

      const pageKey = destinationPath.toLowerCase();
      const existingPage = pageByCanonicalPath.get(pageKey);
      const pageId = existingPage?.id || generateMongoStyleId();
      const seed = buildSeedContent({
        sourceUrl: entry.sourceUrl,
        destinationPath,
        module,
        title
      });

      const mergedSourceUrls = dedupeStrings([...(existingPage?.data?.sourceUrls || []), entry.sourceUrl]);
      const mergedLegacySlugs = dedupeStrings([...(existingPage?.data?.legacySlugs || []), destinationSlug, slugifyGuideText(destinationSlug)]);

      const pageData = {
        ...(existingPage?.data || {}),
        _id: pageId,
        slug: destinationSlug,
        canonicalPath: destinationPath,
        legacySlugs: mergedLegacySlugs,
        depth: destinationPath.split('/').filter(Boolean).length - 1,
        order: priorityForModule(module),
        module,
        pageType,
        intent,
        contentClass,
        templateType,
        title: existingPage?.data?.title || seed.title,
        metaTitle: existingPage?.data?.metaTitle || seed.metaTitle,
        metaDescription: existingPage?.data?.metaDescription || seed.metaDescription,
        excerpt: existingPage?.data?.excerpt || seed.excerpt,
        bodyMarkdown: existingPage?.data?.bodyMarkdown || seed.bodyMarkdown,
        keyTakeaways: Array.isArray(existingPage?.data?.keyTakeaways) && existingPage.data.keyTakeaways.length > 0 ? existingPage.data.keyTakeaways : seed.keyTakeaways,
        faqItems: Array.isArray(existingPage?.data?.faqItems) && existingPage.data.faqItems.length > 0 ? existingPage.data.faqItems : seed.faqItems,
        practiceBlocks: existingPage?.data?.practiceBlocks || seed.practiceBlocks,
        ctaConfig: existingPage?.data?.ctaConfig || seed.ctaConfig,
        state: existingPage?.data?.state || 'outline_ready',
        contentRisk: existingPage?.data?.contentRisk || 'medium',
        sourceUrls: mergedSourceUrls,
        sourceSnapshotVersion: inventoryDate,
        noindex: existingPage?.data?.noindex ?? false,
        changeFrequency: existingPage?.data?.changeFrequency || (module === 'updates' ? 'daily' : 'weekly'),
        priority: existingPage?.data?.priority ?? (module === 'updates' ? 0.9 : 0.75),
        qaPassed: existingPage?.data?.qaPassed ?? false,
        qaScore: existingPage?.data?.qaScore ?? 0,
        citationCoverageScore: existingPage?.data?.citationCoverageScore ?? 0,
        duplicationScore: existingPage?.data?.duplicationScore ?? 0,
        readabilityScore: existingPage?.data?.readabilityScore ?? 0,
        linkValidationPassed: existingPage?.data?.linkValidationPassed ?? false,
        schemaValidationPassed: existingPage?.data?.schemaValidationPassed ?? false,
        authorId: existingPage?.data?.authorId || actorId,
        reviewerId: existingPage?.data?.reviewerId || actorId,
        createdAt: existingPage?.data?.createdAt || nowIso,
        updatedAt: nowIso
      };

      await upsertDocRow(client, 'guide_pages', pageId, pageData, existingPage?.createdAt || pageData.createdAt);
      pageByCanonicalPath.set(pageKey, { id: pageId, data: pageData, createdAt: existingPage?.createdAt || pageData.createdAt });

      if (existingPage) {
        pagesUpdated += 1;
      } else {
        pagesCreated += 1;
      }

      if ((i + 1) % 50 === 0 || i === discoveredEntries.length - 1) {
        // eslint-disable-next-line no-console
        console.log(`progress ${i + 1}/${discoveredEntries.length} (created=${pagesCreated}, updated=${pagesUpdated})`);
      }
    } catch (error: any) {
      failedEntries += 1;
      if (failureSamples.length < 20) {
        failureSamples.push(`${entry.sourceUrl} :: ${error?.message || 'unknown error'}`);
      }
    }
  }

  const finalJobData = {
    ...job,
    status: failedEntries > 0 ? 'completed' : 'completed',
    result: {
      discoveredUrls: discoveredEntries.length,
      sourceMapsUpserted,
      pagesCreated,
      pagesUpdated,
      failedEntries,
      failureSamples
    },
    error: null,
    finishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await upsertDocRow(client, 'guide_import_jobs', job._id, finalJobData, job.createdAt);

  const summary = (
    await client.query(
      'select (select count(*) from guide_pages)::int as guide_pages, (select count(*) from guide_source_maps)::int as guide_source_maps'
    )
  ).rows[0];

  await client.end();

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        jobId: job._id,
        status: finalJobData.status,
        discoveredUrls: discoveredEntries.length,
        sourceMapsUpserted,
        pagesCreated,
        pagesUpdated,
        failedEntries,
        failureSamples,
        totals: summary
      },
      null,
      2
    )
  );
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    // eslint-disable-next-line no-console
    console.error(error?.message || error);
    process.exit(1);
  });
