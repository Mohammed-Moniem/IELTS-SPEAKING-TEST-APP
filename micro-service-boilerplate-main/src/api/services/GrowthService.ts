import { Service } from 'typedi';
import Stripe from 'stripe';

import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { Logger } from '@lib/logger';
import { Types } from '@lib/db/mongooseCompat';
import { AdCampaignModel } from '@models/AdCampaignModel';
import { AdCreativeModel } from '@models/AdCreativeModel';
import { AdPackageModel } from '@models/AdPackageModel';
import { AdPlacementEventModel } from '@models/AdPlacementEventModel';
import { AdvertiserAccountModel } from '@models/AdvertiserAccountModel';
import { BlogJobModel } from '@models/BlogJobModel';
import { BlogPostModel, BlogPostState } from '@models/BlogPostModel';
import { BlogQaReportModel } from '@models/BlogQaReportModel';
import { BlogTopicClusterModel } from '@models/BlogTopicClusterModel';
import { CollocationEntryModel } from '@models/CollocationEntryModel';
import { DeckReviewEventModel } from '@models/DeckReviewEventModel';
import { LexiconEntryModel } from '@models/LexiconEntryModel';
import { ListeningAttemptModel } from '@models/ListeningAttemptModel';
import { ProcessedWebhookEvent } from '@models/PartnerProgramModel';
import { PracticeSessionModel } from '@models/PracticeSessionModel';
import { ReadingAttemptModel } from '@models/ReadingAttemptModel';
import { ResourceRecommendationModel } from '@models/ResourceRecommendationModel';
import { UserLibraryDeckModel } from '@models/UserLibraryDeckModel';
import { UserModel } from '@models/UserModel';
import { WritingSubmissionModel } from '@models/WritingSubmissionModel';
import { StripeService } from './StripeService';

type GrowthRange = '7d' | '30d' | '90d';
type GrowthModule = 'speaking' | 'writing' | 'reading' | 'listening' | 'all';
type LibraryEntryType = 'collocation' | 'vocabulary' | 'resource';

interface BlogQa {
  factCheckConfidence: number;
  duplicationScore: number;
  readabilityScore: number;
  linkValidationPassed: boolean;
  schemaValidationPassed: boolean;
  passed: boolean;
  warnings: string[];
}

interface TopicCluster {
  key: string;
  name: string;
  description?: string;
  priority: number;
  active: boolean;
  refreshCadenceDays: number;
}

interface LibraryQuery {
  search?: string;
  topic?: string;
  module?: 'speaking' | 'writing' | 'reading' | 'listening';
  cefr?: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  limit?: number;
  offset?: number;
}

@Service()
export class GrowthService {
  private readonly log = new Logger(__filename);

  constructor(private readonly stripeService: StripeService) {}

  public async listPublicBlogPosts(query: {
    cluster?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const { limit, offset } = this.resolvePagination(query.limit, query.offset, 24, 0, 500);
    const now = new Date();
    const filter: Record<string, unknown> = {
      state: 'published',
      publishedAt: { $lte: now }
    };

    if (query.cluster) {
      filter.cluster = query.cluster;
    }
    const searchTerm = query.search?.trim();
    if (searchTerm) {
      const safePattern = this.escapeRegex(searchTerm);
      filter.$or = [
        { title: { $regex: safePattern, $options: 'i' } },
        { excerpt: { $regex: safePattern, $options: 'i' } },
        { body: { $regex: safePattern, $options: 'i' } },
        { tags: { $regex: safePattern, $options: 'i' } }
      ];
    }

    const [rows, total] = await Promise.all([
      BlogPostModel.find(filter).sort({ publishedAt: -1, updatedAt: -1 }).skip(offset).limit(limit).lean(),
      BlogPostModel.countDocuments(filter)
    ]);

    return {
      posts: rows.map(row => this.toBlogSummary(row)),
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total
    };
  }

  public async getPublicBlogPostBySlug(slug: string) {
    const row = await BlogPostModel.findOne({
      slug: slug.trim().toLowerCase(),
      state: 'published',
      publishedAt: { $lte: new Date() }
    }).lean();

    if (!row) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Blog post not found');
    }

    return this.toBlogDetail(row);
  }

  public async listAdminBlogPosts(query: {
    cluster?: string;
    state?: BlogPostState;
    limit?: number;
    offset?: number;
  }) {
    const { limit, offset } = this.resolvePagination(query.limit, query.offset, 20, 0, 100);
    const filter: Record<string, unknown> = {};

    if (query.cluster) {
      filter.cluster = query.cluster;
    }
    if (query.state) {
      filter.state = query.state;
    }

    const [rows, total] = await Promise.all([
      BlogPostModel.find(filter).sort({ updatedAt: -1 }).skip(offset).limit(limit).lean(),
      BlogPostModel.countDocuments(filter)
    ]);

    return {
      posts: rows.map(row => this.toBlogSummary(row)),
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total
    };
  }

  public async generateBlogIdeas(input: { cluster?: string; count?: number }, actorUserId: string) {
    const count = Math.max(1, Math.min(50, input.count || 5));
    const actor = this.toObjectId(actorUserId, 'Invalid actor user id');
    const clusters = await this.ensureTopicClusters();
    const selectedClusters = input.cluster
      ? clusters.filter(item => item.key === input.cluster)
      : clusters.filter(item => item.active);

    if (!selectedClusters.length) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'No blog topic clusters available');
    }

    const ideas: Array<{ title: string; slug: string; cluster: string }> = [];
    for (let i = 0; i < count; i++) {
      const cluster = selectedClusters[i % selectedClusters.length];
      const title = this.generateBlogIdeaTitle(cluster.name, i + 1);
      const slug = await this.ensureUniqueSlug(this.slugify(title));
      ideas.push({ title, slug, cluster: cluster.key });
    }

    const docs = ideas.map(idea => ({
      title: idea.title,
      slug: idea.slug,
      excerpt: `Planning brief for ${idea.cluster} cluster`,
      body: 'Idea stage. Expand this into a full outline before drafting.',
      cluster: idea.cluster,
      tags: ['ielts', idea.cluster, 'ai-generated'],
      state: 'idea' as BlogPostState,
      contentRisk: 'low_risk_update' as const,
      qaPassed: false,
      sourceLinks: [],
      createdByUserId: actor,
      updatedByUserId: actor,
      lastUpdatedAt: new Date()
    }));

    const createdRows = await BlogPostModel.insertMany(docs);
    const job = await BlogJobModel.create({
      type: 'generate_ideas',
      status: 'completed',
      payload: {
        cluster: input.cluster || 'all',
        count
      },
      result: {
        created: createdRows.length,
        postIds: createdRows.map(row => row._id.toString())
      },
      createdByUserId: actor,
      startedAt: new Date(),
      finishedAt: new Date()
    });

    return {
      jobId: job._id.toString(),
      ideas: createdRows.map(row => this.toBlogSummary(row))
    };
  }

  public async createBlogDraft(
    input: {
      title: string;
      slug?: string;
      cluster?: string;
      tags?: string[];
      excerpt?: string;
      body?: string;
      contentRisk?: 'low_risk_update' | 'pillar' | 'commercial';
      scheduleAutoPublish?: boolean;
      scheduledAt?: string;
    },
    actorUserId: string
  ) {
    const actor = this.toObjectId(actorUserId, 'Invalid actor user id');
    const clusters = await this.ensureTopicClusters();
    const cluster = input.cluster || clusters.find(item => item.active)?.key || 'speaking';
    const slug = await this.ensureUniqueSlug(this.slugify(input.slug || input.title));
    const now = new Date();
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
    const body = input.body?.trim() || `# ${input.title}\n\nDraft pending expansion and editor review.`;
    const contentRisk = input.contentRisk || 'low_risk_update';
    const qa = this.scoreBlogQa({
      title: input.title,
      body,
      sourceLinks: this.extractLinks(body)
    });

    const shouldAutoPublish =
      contentRisk === 'low_risk_update' &&
      qa.passed &&
      Boolean(input.scheduleAutoPublish) &&
      (!scheduledAt || scheduledAt.getTime() <= now.getTime());

    let state: BlogPostState = 'draft';
    if (shouldAutoPublish) {
      state = 'published';
    } else if (qa.passed && contentRisk === 'low_risk_update') {
      state = 'qa_passed';
    } else if (qa.passed) {
      state = 'pending_review';
    }

    const post = await BlogPostModel.create({
      title: input.title.trim(),
      slug,
      excerpt: input.excerpt?.trim(),
      body,
      cluster,
      tags: input.tags || [],
      state,
      contentRisk,
      qaPassed: qa.passed,
      qaScore: this.qaScoreFromQa(qa),
      factCheckConfidence: qa.factCheckConfidence,
      duplicationScore: qa.duplicationScore,
      readabilityScore: qa.readabilityScore,
      linkValidationPassed: qa.linkValidationPassed,
      schemaValidationPassed: qa.schemaValidationPassed,
      sourceLinks: this.extractLinks(body),
      scheduledAt,
      publishedAt: shouldAutoPublish ? now : undefined,
      lastReviewedAt: shouldAutoPublish ? now : undefined,
      lastUpdatedAt: now,
      createdByUserId: actor,
      updatedByUserId: actor
    });

    const qaReport = await BlogQaReportModel.create({
      postId: post._id,
      factCheckConfidence: qa.factCheckConfidence,
      duplicationScore: qa.duplicationScore,
      readabilityScore: qa.readabilityScore,
      linkValidationPassed: qa.linkValidationPassed,
      schemaValidationPassed: qa.schemaValidationPassed,
      passed: qa.passed,
      warnings: qa.warnings
    });

    post.qaReportId = qaReport._id;
    await post.save();

    await BlogJobModel.create({
      type: 'draft_post',
      status: 'completed',
      payload: {
        postId: post._id.toString()
      },
      result: {
        state: post.state,
        qaPassed: qa.passed,
        qaScore: post.qaScore
      },
      postId: post._id,
      createdByUserId: actor,
      startedAt: now,
      finishedAt: new Date()
    });

    return {
      post: this.toBlogDetail(post),
      qaReport: {
        id: qaReport._id.toString(),
        score: this.qaScoreFromQa(qa),
        ...qa
      }
    };
  }

  public async reviewBlogPost(
    postId: string,
    input: { decision: 'approved' | 'rejected' | 'changes_requested'; notes?: string },
    actorUserId: string
  ) {
    const actor = this.toObjectId(actorUserId, 'Invalid actor user id');
    const post = await BlogPostModel.findById(postId);
    if (!post) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Blog post not found');
    }

    if (input.decision === 'approved') {
      post.state = post.qaPassed ? 'qa_passed' : 'pending_review';
      post.reviewedByUserId = actor;
      post.lastReviewedAt = new Date();
    } else if (input.decision === 'rejected') {
      post.state = 'draft';
    } else {
      post.state = 'pending_review';
    }

    post.lastUpdatedAt = new Date();
    await post.save();

    if (input.notes?.trim()) {
      await BlogJobModel.create({
        type: 'refresh_content',
        status: 'queued',
        payload: {
          reviewNotes: input.notes.trim()
        },
        postId: post._id,
        createdByUserId: actor
      });
    }

    return this.toBlogDetail(post);
  }

  public async publishBlogPost(postId: string, actorUserId: string) {
    const actor = this.toObjectId(actorUserId, 'Invalid actor user id');
    const post = await BlogPostModel.findById(postId);
    if (!post) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Blog post not found');
    }

    if (!post.qaPassed) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'QA gates not passed for this post');
    }

    const requiresManualReview = post.contentRisk === 'pillar' || post.contentRisk === 'commercial';
    if (requiresManualReview && !post.reviewedByUserId) {
      throw new CSError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        CODES.InvalidBody,
        'Manual review approval is required before publishing this post'
      );
    }

    post.state = 'published';
    post.publishedAt = new Date();
    post.lastReviewedAt = post.lastReviewedAt || new Date();
    post.lastUpdatedAt = new Date();
    post.updatedByUserId = actor;
    await post.save();

    return this.toBlogDetail(post);
  }

  public async getSeoContentHealth() {
    const clusters = await this.ensureTopicClusters();
    const now = new Date();
    const [totalPosts, publishedPosts, pendingReviewPosts, failedQaPosts] = await Promise.all([
      BlogPostModel.countDocuments({}),
      BlogPostModel.countDocuments({ state: 'published' }),
      BlogPostModel.countDocuments({ state: 'pending_review' }),
      BlogPostModel.countDocuments({ qaPassed: false })
    ]);

    const clusterHealth = await Promise.all(
      clusters.map(async cluster => {
        const staleBefore = new Date(now.getTime() - cluster.refreshCadenceDays * 24 * 60 * 60 * 1000);
        const [publishedCount, staleCount, queuedRefreshJobs] = await Promise.all([
          BlogPostModel.countDocuments({ cluster: cluster.key, state: 'published' }),
          BlogPostModel.countDocuments({
            cluster: cluster.key,
            state: 'published',
            $or: [{ lastUpdatedAt: { $lt: staleBefore } }, { publishedAt: { $lt: staleBefore } }]
          }),
          BlogJobModel.countDocuments({
            type: 'refresh_content',
            status: { $in: ['queued', 'running'] },
            payload: { cluster: cluster.key }
          })
        ]);

        return {
          key: cluster.key,
          name: cluster.name,
          refreshCadenceDays: cluster.refreshCadenceDays,
          publishedCount,
          staleCount,
          queuedRefreshJobs
        };
      })
    );

    const [schemaFailures, brokenLinkPosts, qaJobsQueued] = await Promise.all([
      BlogQaReportModel.countDocuments({ schemaValidationPassed: false }),
      BlogQaReportModel.countDocuments({ linkValidationPassed: false }),
      BlogJobModel.countDocuments({ status: { $in: ['queued', 'running'] } })
    ]);

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        totalPosts,
        publishedPosts,
        pendingReviewPosts,
        failedQaPosts,
        schemaFailures,
        brokenLinkPosts,
        queuedJobs: qaJobsQueued
      },
      clusters: clusterHealth
    };
  }

  public async enqueueSeoRefreshQueue(input: { cluster?: string; limit?: number }, actorUserId?: string) {
    const actor = actorUserId ? this.toObjectId(actorUserId, 'Invalid actor user id') : undefined;
    const limit = Math.max(1, Math.min(500, input.limit || 50));
    const clusters = await this.ensureTopicClusters();
    const clusterMap = new Map(clusters.map(item => [item.key, item]));
    const targetClusters = input.cluster ? [input.cluster] : clusters.filter(item => item.active).map(item => item.key);

    const staleCandidates: Array<{ _id: Types.ObjectId; cluster: string }> = [];
    for (const key of targetClusters) {
      const cluster = clusterMap.get(key);
      if (!cluster) continue;
      const staleBefore = new Date(Date.now() - cluster.refreshCadenceDays * 24 * 60 * 60 * 1000);
      const rows = await BlogPostModel.find({
        cluster: key,
        state: 'published',
        $or: [{ lastUpdatedAt: { $lt: staleBefore } }, { publishedAt: { $lt: staleBefore } }]
      })
        .sort({ lastUpdatedAt: 1, publishedAt: 1 })
        .limit(limit)
        .select('_id cluster')
        .lean();
      rows.forEach(row => {
        staleCandidates.push({ _id: row._id, cluster: row.cluster });
      });
      if (staleCandidates.length >= limit) break;
    }

    const selected = staleCandidates.slice(0, limit);
    if (!selected.length) {
      return {
        queued: 0,
        skipped: 0,
        postIds: []
      };
    }

    const existing = await BlogJobModel.find({
      type: 'refresh_content',
      status: { $in: ['queued', 'running'] },
      postId: { $in: selected.map(item => item._id) }
    })
      .select('postId')
      .lean();

    const alreadyQueued = new Set(existing.map(item => item.postId?.toString()).filter(Boolean) as string[]);
    const queueDocs = selected
      .filter(item => !alreadyQueued.has(item._id.toString()))
      .map(item => ({
        type: 'refresh_content' as const,
        status: 'queued' as const,
        payload: {
          cluster: item.cluster
        },
        postId: item._id,
        ...(actor ? { createdByUserId: actor } : {})
      }));

    if (queueDocs.length) {
      await BlogJobModel.insertMany(queueDocs, { ordered: false });
    }

    return {
      queued: queueDocs.length,
      skipped: selected.length - queueDocs.length,
      postIds: queueDocs.map(item => item.postId.toString())
    };
  }

  public async getStrengthMap(userId: string, range: GrowthRange) {
    const userObjectId = this.toObjectId(userId, 'Invalid user id');
    const { from, to, key } = this.resolveRange(range);

    const [practiceRows, writingRows, readingRows, listeningRows] = await Promise.all([
      PracticeSessionModel.find({
        user: userObjectId,
        status: 'completed',
        createdAt: { $gte: from, $lte: to }
      })
        .sort({ createdAt: 1 })
        .lean(),
      WritingSubmissionModel.find({
        userId: userObjectId,
        createdAt: { $gte: from, $lte: to }
      })
        .sort({ createdAt: 1 })
        .lean(),
      ReadingAttemptModel.find({
        userId: userObjectId,
        status: 'completed',
        createdAt: { $gte: from, $lte: to }
      })
        .sort({ createdAt: 1 })
        .lean(),
      ListeningAttemptModel.find({
        userId: userObjectId,
        status: 'completed',
        createdAt: { $gte: from, $lte: to }
      })
        .sort({ createdAt: 1 })
        .lean()
    ]);

    const points: Record<string, Array<{ x: string; y: number }>> = {
      speaking_pronunciation: [],
      speaking_fluency: [],
      speaking_lexical_resource: [],
      speaking_grammatical_range: [],
      writing_task_response: [],
      writing_coherence_cohesion: [],
      writing_lexical_resource: [],
      writing_grammatical_range_accuracy: [],
      reading_accuracy: [],
      listening_accuracy: []
    };

    practiceRows.forEach(row => {
      const createdAt = new Date(row.createdAt).toISOString();
      const breakdown = row.feedback?.bandBreakdown || {};
      if (typeof breakdown.pronunciation === 'number') points.speaking_pronunciation.push({ x: createdAt, y: breakdown.pronunciation });
      if (typeof breakdown.fluency === 'number') points.speaking_fluency.push({ x: createdAt, y: breakdown.fluency });
      if (typeof breakdown.lexicalResource === 'number') points.speaking_lexical_resource.push({ x: createdAt, y: breakdown.lexicalResource });
      if (typeof breakdown.grammaticalRange === 'number') points.speaking_grammatical_range.push({ x: createdAt, y: breakdown.grammaticalRange });
    });

    writingRows.forEach(row => {
      const createdAt = new Date(row.createdAt).toISOString();
      if (typeof row.breakdown?.taskResponse === 'number') points.writing_task_response.push({ x: createdAt, y: row.breakdown.taskResponse });
      if (typeof row.breakdown?.coherenceCohesion === 'number') points.writing_coherence_cohesion.push({ x: createdAt, y: row.breakdown.coherenceCohesion });
      if (typeof row.breakdown?.lexicalResource === 'number') points.writing_lexical_resource.push({ x: createdAt, y: row.breakdown.lexicalResource });
      if (typeof row.breakdown?.grammaticalRangeAccuracy === 'number') {
        points.writing_grammatical_range_accuracy.push({ x: createdAt, y: row.breakdown.grammaticalRangeAccuracy });
      }
    });

    readingRows.forEach(row => {
      points.reading_accuracy.push({ x: new Date(row.createdAt).toISOString(), y: Number(row.normalizedBand || 0) });
    });
    listeningRows.forEach(row => {
      points.listening_accuracy.push({ x: new Date(row.createdAt).toISOString(), y: Number(row.normalizedBand || 0) });
    });

    const criteria = [
      this.toCriterion('speaking_pronunciation', 'speaking', 'Pronunciation', points.speaking_pronunciation),
      this.toCriterion('speaking_fluency', 'speaking', 'Fluency & Coherence', points.speaking_fluency),
      this.toCriterion('speaking_lexical_resource', 'speaking', 'Lexical Resource', points.speaking_lexical_resource),
      this.toCriterion('speaking_grammatical_range', 'speaking', 'Grammar Accuracy', points.speaking_grammatical_range),
      this.toCriterion('writing_task_response', 'writing', 'Task Response', points.writing_task_response),
      this.toCriterion('writing_coherence_cohesion', 'writing', 'Coherence & Cohesion', points.writing_coherence_cohesion),
      this.toCriterion('writing_lexical_resource', 'writing', 'Lexical Resource', points.writing_lexical_resource),
      this.toCriterion(
        'writing_grammatical_range_accuracy',
        'writing',
        'Grammatical Range & Accuracy',
        points.writing_grammatical_range_accuracy
      ),
      this.toCriterion('reading_accuracy', 'reading', 'Reading Accuracy', points.reading_accuracy),
      this.toCriterion('listening_accuracy', 'listening', 'Listening Accuracy', points.listening_accuracy)
    ];

    const nonEmptyCriteria = criteria.filter(item => item.dataPoints > 0);
    const overallSufficiency = this.dataSufficiencyLevel(nonEmptyCriteria.reduce((sum, item) => sum + item.dataPoints, 0));
    const strongest = [...nonEmptyCriteria].sort((a, b) => b.averageScore - a.averageScore).slice(0, 3);
    const weakest = [...nonEmptyCriteria].sort((a, b) => a.averageScore - b.averageScore).slice(0, 3);

    return {
      generatedAt: new Date().toISOString(),
      range: key,
      from: from.toISOString(),
      to: to.toISOString(),
      dataSufficiency: overallSufficiency,
      criteria: nonEmptyCriteria,
      strongest,
      weakest
    };
  }

  public async getImprovementPlan(userId: string, module: GrowthModule) {
    const strength = await this.getStrengthMap(userId, '30d');
    const filtered = module === 'all' ? strength.criteria : strength.criteria.filter(item => item.module === module);
    const weakest = [...filtered].sort((a, b) => a.averageScore - b.averageScore).slice(0, 4);

    const recommendationsByModule = await Promise.all(
      ['speaking', 'writing', 'reading', 'listening'].map(async moduleKey => {
        const [collocations, vocabulary, resources] = await Promise.all([
          CollocationEntryModel.find({ active: true, module: moduleKey }).sort({ qualityScore: -1 }).limit(3).lean(),
          LexiconEntryModel.find({ active: true, module: moduleKey }).sort({ qualityScore: -1 }).limit(3).lean(),
          ResourceRecommendationModel.find({ active: true, module: { $in: [moduleKey, 'all'] } })
            .sort({ qualityScore: -1, sponsored: -1 })
            .limit(3)
            .lean()
        ]);

        return {
          module: moduleKey,
          resources: [
            ...collocations.map(item => ({
              id: item._id.toString(),
              type: 'collocation',
              title: item.phrase,
              subtitle: item.meaning
            })),
            ...vocabulary.map(item => ({
              id: item._id.toString(),
              type: 'vocabulary',
              title: item.lemma,
              subtitle: item.definition
            })),
            ...resources.map(item => ({
              id: item._id.toString(),
              type: item.type,
              title: item.title,
              subtitle: item.provider,
              url: item.url
            }))
          ].slice(0, 6)
        };
      })
    );

    const recommendationMap = new Map(recommendationsByModule.map(item => [item.module, item.resources]));
    const cards = weakest.map(item => {
      const targetBand = 7;
      const delta = Math.max(0, this.round(targetBand - item.averageScore, 2));
      return {
        criterionKey: item.key,
        module: item.module,
        title: item.label,
        currentBand: item.averageScore,
        targetBand,
        deltaToTarget: delta,
        confidence: item.confidence,
        dataPoints: item.dataPoints,
        expectedBandImpact: this.round(Math.min(0.7, Math.max(0.2, delta * 0.3)), 2),
        recommendedAction: this.recommendedAction(item.module, item.label),
        deepLink: this.moduleDeepLink(item.module),
        supportingResources: recommendationMap.get(item.module) || []
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      module,
      dataSufficiency: strength.dataSufficiency,
      predictionConfidence: this.predictionConfidenceFromCards(cards.length, strength.dataSufficiency),
      cards
    };
  }

  public async listCollocations(query: LibraryQuery) {
    const { limit, offset } = this.resolvePagination(query.limit, query.offset, 24, 0, 200);
    const filter = this.buildLibraryFilter(query);
    const [rows, total] = await Promise.all([
      CollocationEntryModel.find(filter).sort({ qualityScore: -1, frequencyRank: 1, updatedAt: -1 }).skip(offset).limit(limit).lean(),
      CollocationEntryModel.countDocuments(filter)
    ]);

    return {
      items: rows.map(row => ({
        id: row._id.toString(),
        phrase: row.phrase,
        meaning: row.meaning,
        module: row.module,
        cefr: row.cefr,
        topic: row.topic,
        examples: row.examples,
        alternatives: row.alternatives,
        difficulty: this.toDifficulty(row.cefr),
        qualityScore: row.qualityScore
      })),
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total
    };
  }

  public async listVocabulary(query: LibraryQuery) {
    const { limit, offset } = this.resolvePagination(query.limit, query.offset, 24, 0, 200);
    const filter = this.buildLibraryFilter(query);
    const [rows, total] = await Promise.all([
      LexiconEntryModel.find(filter).sort({ qualityScore: -1, frequencyRank: 1, updatedAt: -1 }).skip(offset).limit(limit).lean(),
      LexiconEntryModel.countDocuments(filter)
    ]);

    return {
      items: rows.map(row => ({
        id: row._id.toString(),
        lemma: row.lemma,
        definition: row.definition,
        module: row.module,
        cefr: row.cefr,
        topic: row.topic,
        synonyms: row.synonyms,
        examples: row.examples,
        difficulty: this.toDifficulty(row.cefr),
        qualityScore: row.qualityScore
      })),
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total
    };
  }

  public async listResources(type: 'book' | 'channel', query: LibraryQuery) {
    const { limit, offset } = this.resolvePagination(query.limit, query.offset, 24, 0, 200);
    const filter = this.buildLibraryFilter(query);
    filter.type = type;

    const [rows, total] = await Promise.all([
      ResourceRecommendationModel.find(filter).sort({ sponsored: -1, qualityScore: -1, updatedAt: -1 }).skip(offset).limit(limit).lean(),
      ResourceRecommendationModel.countDocuments(filter)
    ]);

    return {
      items: rows.map(row => ({
        id: row._id.toString(),
        type: row.type,
        title: row.title,
        provider: row.provider,
        url: row.url,
        description: row.description,
        module: row.module,
        topic: row.topic,
        cefr: row.cefr,
        difficulty: row.difficulty,
        sponsored: row.sponsored,
        sponsorPartnerId: row.sponsorPartnerId,
        qualityScore: row.qualityScore
      })),
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total
    };
  }

  public async createLibraryDeck(
    userId: string,
    input: {
      name: string;
      description?: string;
      entryType: LibraryEntryType;
      entryIds: string[];
    }
  ) {
    const userObjectId = this.toObjectId(userId, 'Invalid user id');
    const uniqueEntryIds = Array.from(new Set((input.entryIds || []).map(item => item.trim()).filter(Boolean)));
    if (!uniqueEntryIds.length) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Deck requires at least one entry id');
    }

    const objectIds = uniqueEntryIds.filter(value => Types.ObjectId.isValid(value)).map(value => new Types.ObjectId(value));
    if (!objectIds.length) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'No valid entry ids provided');
    }

    const modelCount =
      input.entryType === 'collocation'
        ? await CollocationEntryModel.countDocuments({ _id: { $in: objectIds }, active: true })
        : input.entryType === 'vocabulary'
          ? await LexiconEntryModel.countDocuments({ _id: { $in: objectIds }, active: true })
          : await ResourceRecommendationModel.countDocuments({ _id: { $in: objectIds }, active: true });

    if (modelCount !== objectIds.length) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'One or more deck entries are invalid or inactive');
    }

    const deck = await UserLibraryDeckModel.create({
      userId: userObjectId,
      name: input.name.trim(),
      description: input.description?.trim(),
      entryType: input.entryType,
      entryIds: uniqueEntryIds,
      source: 'manual',
      active: true
    });

    const reviewEvents = uniqueEntryIds.map(entryId => ({
      userId: userObjectId,
      deckId: deck._id,
      entryType: input.entryType,
      entryId,
      eventType: 'add' as const,
      intervalDays: 1,
      nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }));
    await DeckReviewEventModel.insertMany(reviewEvents, { ordered: false });

    return {
      deck: {
        id: deck._id.toString(),
        name: deck.name,
        description: deck.description,
        entryType: deck.entryType,
        entryIds: deck.entryIds,
        createdAt: deck.createdAt,
        updatedAt: deck.updatedAt
      },
      addedEntries: reviewEvents.length
    };
  }

  public async getLibraryReviewQueue(userId: string, limitInput?: number) {
    const userObjectId = this.toObjectId(userId, 'Invalid user id');
    const limit = Math.max(1, Math.min(300, Number(limitInput || 60)));
    const now = new Date();

    const events = await DeckReviewEventModel.find({
      userId: userObjectId,
      nextReviewAt: { $lte: now },
      eventType: { $in: ['add', 'review'] }
    })
      .sort({ nextReviewAt: 1 })
      .limit(limit)
      .lean();

    if (!events.length) {
      return {
        generatedAt: now.toISOString(),
        dueCount: 0,
        items: []
      };
    }

    const deckIds = Array.from(new Set(events.map(item => item.deckId.toString())));
    const decksRaw = await UserLibraryDeckModel.find({ _id: { $in: deckIds }, userId: userObjectId }).lean();
    const decks = decksRaw as Array<any>;
    const deckMap = new Map(decks.map(deck => [deck._id.toString(), deck]));

    return {
      generatedAt: now.toISOString(),
      dueCount: events.length,
      items: events.map(event => ({
        eventId: event._id.toString(),
        deckId: event.deckId.toString(),
        deckName: deckMap.get(event.deckId.toString())?.name || 'Practice deck',
        entryType: event.entryType,
        entryId: event.entryId,
        intervalDays: event.intervalDays || 1,
        nextReviewAt: event.nextReviewAt
      }))
    };
  }

  public async recordDeckReviewEvent(
    userId: string,
    deckId: string,
    input: {
      entryId: string;
      rating: 'again' | 'hard' | 'good' | 'easy' | 'mastered';
      qualityScore?: number;
    }
  ) {
    const userObjectId = this.toObjectId(userId, 'Invalid user id');
    const deckObjectId = this.toObjectId(deckId, 'Invalid deck id');
    const deck = await UserLibraryDeckModel.findOne({ _id: deckObjectId, userId: userObjectId, active: true });
    if (!deck) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Library deck not found');
    }

    const latest = await DeckReviewEventModel.findOne({
      userId: userObjectId,
      deckId: deckObjectId,
      entryId: input.entryId.trim()
    })
      .sort({ createdAt: -1 })
      .lean();

    const baseInterval = Math.max(1, Number(latest?.intervalDays || 1));
    const rating = input.rating;
    let nextIntervalDays = 1;
    if (rating === 'hard') nextIntervalDays = Math.min(30, Math.max(1, Math.round(baseInterval * 1.3)));
    if (rating === 'good') nextIntervalDays = Math.min(45, Math.max(1, Math.round(baseInterval * 2)));
    if (rating === 'easy') nextIntervalDays = Math.min(60, Math.max(2, Math.round(baseInterval * 3)));
    if (rating === 'mastered') nextIntervalDays = 90;

    const nextReviewAt =
      rating === 'mastered' ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) : new Date(Date.now() + nextIntervalDays * 24 * 60 * 60 * 1000);

    const event = await DeckReviewEventModel.create({
      userId: userObjectId,
      deckId: deckObjectId,
      entryType: deck.entryType,
      entryId: input.entryId.trim(),
      eventType: rating === 'mastered' ? 'mastered' : 'review',
      qualityScore: input.qualityScore,
      intervalDays: nextIntervalDays,
      nextReviewAt,
      metadata: {
        rating
      }
    });

    return {
      eventId: event._id.toString(),
      deckId: deck._id.toString(),
      entryId: event.entryId,
      rating,
      intervalDays: nextIntervalDays,
      nextReviewAt: event.nextReviewAt
    };
  }

  public async createAdPackage(
    input: {
      key: string;
      name: string;
      description: string;
      placementType: 'homepage_sponsor' | 'module_panel' | 'blog_block' | 'newsletter_slot' | 'partner_spotlight';
      billingType: 'monthly_subscription' | 'quarterly_subscription' | 'annual_subscription' | 'one_time';
      stripePriceId?: string;
      currency?: string;
      priceAmount: number;
      features?: string[];
      isActive?: boolean;
    },
    actorUserId: string
  ) {
    const actor = this.toObjectId(actorUserId, 'Invalid actor user id');
    const key = input.key.trim().toLowerCase();
    const existing = await AdPackageModel.findOne({ key });
    if (existing) {
      throw new CSError(HTTP_STATUS_CODES.CONFLICT, CODES.InvalidBody, 'Ad package key already exists');
    }

    const created = await AdPackageModel.create({
      key,
      name: input.name.trim(),
      description: input.description.trim(),
      placementType: input.placementType,
      billingType: input.billingType,
      stripePriceId: input.stripePriceId?.trim(),
      currency: (input.currency || 'USD').toUpperCase(),
      priceAmount: input.priceAmount,
      features: input.features || [],
      isActive: input.isActive !== false,
      createdByUserId: actor,
      updatedByUserId: actor
    });

    return this.toAdPackage(created);
  }

  public async listAdCampaigns(query: {
    status?: 'draft' | 'pending_review' | 'approved' | 'scheduled' | 'active' | 'paused' | 'completed' | 'rejected';
    limit?: number;
    offset?: number;
  }) {
    const { limit, offset } = this.resolvePagination(query.limit, query.offset, 20, 0, 100);
    const filter: Record<string, unknown> = {};
    if (query.status) {
      filter.status = query.status;
    }

    const [rows, total] = await Promise.all([
      AdCampaignModel.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      AdCampaignModel.countDocuments(filter)
    ]);

    const packageIds = Array.from(new Set(rows.map(row => row.packageId?.toString()).filter(Boolean)));
    const accountIds = Array.from(new Set(rows.map(row => row.advertiserAccountId?.toString()).filter(Boolean)));
    const [packagesRaw, accountsRaw] = await Promise.all([
      packageIds.length ? AdPackageModel.find({ _id: { $in: packageIds } }).lean() : [],
      accountIds.length ? AdvertiserAccountModel.find({ _id: { $in: accountIds } }).lean() : []
    ]);
    const packages = packagesRaw as Array<any>;
    const accounts = accountsRaw as Array<any>;
    const packageMap = new Map(packages.map(item => [item._id.toString(), item]));
    const accountMap = new Map(accounts.map(item => [item._id.toString(), item]));

    return {
      items: rows.map(row => {
        const pkg = packageMap.get(row.packageId.toString());
        const account = accountMap.get(row.advertiserAccountId.toString());
        return {
          id: row._id.toString(),
          name: row.name,
          status: row.status,
          placementType: row.placementType,
          package: pkg ? this.toAdPackage(pkg) : null,
          advertiser: account
            ? {
                id: account._id.toString(),
                displayName: account.displayName,
                contactEmail: account.contactEmail,
                status: account.status
              }
            : null,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          metrics: row.metrics,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        };
      }),
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total
    };
  }

  public async createAdCampaign(
    input: {
      name: string;
      packageId: string;
      advertiserAccountId?: string;
      startsAt?: string;
      endsAt?: string;
      targeting?: Record<string, unknown>;
      creative?: Record<string, unknown>;
    },
    actorUserId: string
  ) {
    const actor = this.toObjectId(actorUserId, 'Invalid actor user id');
    const adPackage = await AdPackageModel.findById(input.packageId).lean();
    if (!adPackage || !adPackage.isActive) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid or inactive ad package');
    }

    let account = input.advertiserAccountId
      ? await AdvertiserAccountModel.findById(input.advertiserAccountId)
      : await AdvertiserAccountModel.findOne({ ownerUserId: actor });

    if (!account) {
      const user = await UserModel.findById(actor).lean();
      if (!user) {
        throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Advertiser owner user not found');
      }
      account = await AdvertiserAccountModel.create({
        ownerUserId: actor,
        displayName: `${user.firstName} ${user.lastName}`.trim() || user.email,
        contactEmail: user.email,
        status: 'pending'
      });
    }

    const campaign = await AdCampaignModel.create({
      name: input.name.trim(),
      packageId: adPackage._id,
      advertiserAccountId: account._id,
      placementType: adPackage.placementType,
      status: 'pending_review',
      targeting: input.targeting || {},
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      metrics: {
        impressions: 0,
        clicks: 0,
        conversions: 0
      },
      createdByUserId: actor,
      updatedByUserId: actor
    });

    const creativePayload = input.creative || {};
    const headline = typeof creativePayload.headline === 'string' ? creativePayload.headline.trim() : campaign.name;
    const creativeValidation = this.validateAdCreative({
      headline,
      ctaUrl: typeof creativePayload.ctaUrl === 'string' ? creativePayload.ctaUrl : undefined
    });
    const creative = await AdCreativeModel.create({
      campaignId: campaign._id,
      placementType: adPackage.placementType,
      headline,
      body: typeof creativePayload.body === 'string' ? creativePayload.body : undefined,
      ctaLabel: typeof creativePayload.ctaLabel === 'string' ? creativePayload.ctaLabel : undefined,
      ctaUrl: typeof creativePayload.ctaUrl === 'string' ? creativePayload.ctaUrl : undefined,
      imageUrl: typeof creativePayload.imageUrl === 'string' ? creativePayload.imageUrl : undefined,
      status: creativeValidation.passed ? 'pending_review' : 'draft',
      validation: creativeValidation,
      submittedAt: new Date()
    });

    return {
      campaignId: campaign._id.toString(),
      status: campaign.status,
      creative: {
        id: creative._id.toString(),
        status: creative.status,
        validation: creative.validation
      }
    };
  }

  public async updateAdCampaignStatus(
    campaignId: string,
    input: {
      status: 'draft' | 'pending_review' | 'approved' | 'scheduled' | 'active' | 'paused' | 'completed' | 'rejected';
      notes?: string;
    },
    actorUserId: string
  ) {
    const actor = this.toObjectId(actorUserId, 'Invalid actor user id');
    const campaign = await AdCampaignModel.findById(campaignId);
    if (!campaign) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Ad campaign not found');
    }

    campaign.status = input.status;
    campaign.updatedByUserId = actor;
    campaign.reviewNotes = input.notes?.trim();
    if (input.status === 'approved') {
      campaign.approvedByUserId = actor;
      campaign.approvedAt = new Date();
    }
    if (input.status === 'active' && !campaign.startsAt) {
      campaign.startsAt = new Date();
    }
    if (input.status === 'completed' && !campaign.endsAt) {
      campaign.endsAt = new Date();
    }
    await campaign.save();

    return {
      id: campaign._id.toString(),
      status: campaign.status,
      reviewNotes: campaign.reviewNotes,
      approvedAt: campaign.approvedAt,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      updatedAt: campaign.updatedAt
    };
  }

  public async getAdAnalytics() {
    const [campaignsRaw, packagesRaw, eventsRaw, accountsRaw] = await Promise.all([
      AdCampaignModel.find({}).lean(),
      AdPackageModel.find({}).lean(),
      AdPlacementEventModel.find({}).lean(),
      AdvertiserAccountModel.find({}).lean()
    ]);
    const campaigns = campaignsRaw as Array<any>;
    const packages = packagesRaw as Array<any>;
    const events = eventsRaw as Array<any>;
    const accounts = accountsRaw as Array<any>;

    const packageMap = new Map(packages.map(item => [item._id.toString(), item]));
    const byStatus = campaigns.reduce(
      (acc, campaign) => {
        acc[campaign.status] = (acc[campaign.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byPlacement = campaigns.reduce(
      (acc, campaign) => {
        acc[campaign.placementType] = (acc[campaign.placementType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const impressions = events.filter(event => event.action === 'impression').length;
    const clicks = events.filter(event => event.action === 'click').length;
    const conversions = campaigns.reduce((sum, campaign) => sum + Number(campaign.metrics?.conversions || 0), 0);

    const estimatedMonthlyRevenue = campaigns
      .filter(campaign => ['active', 'approved', 'scheduled'].includes(campaign.status))
      .reduce((sum, campaign) => {
        const adPackage = packageMap.get(campaign.packageId.toString());
        if (!adPackage) return sum;
        return sum + Number(adPackage.priceAmount || 0);
      }, 0);

    const topCampaigns = campaigns
      .map(campaign => ({
        id: campaign._id.toString(),
        name: campaign.name,
        status: campaign.status,
        placementType: campaign.placementType,
        metrics: campaign.metrics || { impressions: 0, clicks: 0, conversions: 0 },
        ctr:
          Number(campaign.metrics?.impressions || 0) > 0
            ? this.round((Number(campaign.metrics?.clicks || 0) / Number(campaign.metrics?.impressions || 1)) * 100, 2)
            : 0
      }))
      .sort((a, b) => Number(b.metrics.impressions || 0) - Number(a.metrics.impressions || 0))
      .slice(0, 10);

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        campaignCount: campaigns.length,
        advertiserCount: accounts.length,
        impressions,
        clicks,
        conversions,
        ctrPercent: impressions > 0 ? this.round((clicks / impressions) * 100, 2) : 0,
        estimatedMonthlyRevenueUsd: this.round(estimatedMonthlyRevenue, 2)
      },
      byStatus,
      byPlacement,
      topCampaigns
    };
  }

  public async createAdvertiserCheckoutSession(
    userId: string,
    input: { packageId: string; successUrl: string; cancelUrl: string; couponCode?: string }
  ) {
    if (!this.stripeService.isConfigured()) {
      throw new CSError(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE, CODES.StripeError, 'Stripe integration is not configured');
    }

    const userObjectId = this.toObjectId(userId, 'Invalid user id');
    const user = await UserModel.findById(userObjectId).lean();
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    const adPackage = await AdPackageModel.findById(input.packageId).lean();
    if (!adPackage || !adPackage.isActive) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid ad package');
    }
    if (!adPackage.stripePriceId) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Selected ad package is not billable yet');
    }

    let advertiser = await AdvertiserAccountModel.findOne({ ownerUserId: userObjectId });
    if (!advertiser) {
      advertiser = await AdvertiserAccountModel.create({
        ownerUserId: userObjectId,
        displayName: `${user.firstName} ${user.lastName}`.trim() || user.email,
        contactEmail: user.email,
        status: 'pending',
        activePackageId: adPackage._id
      });
    } else {
      advertiser.activePackageId = adPackage._id;
      await advertiser.save();
    }

    const promotionCodeId = input.couponCode
      ? await this.stripeService.findPromotionCodeIdByCode(input.couponCode)
      : undefined;

    const mode = adPackage.billingType === 'one_time' ? 'payment' : 'subscription';
    const session = await this.stripeService.createExternalCheckoutSession({
      mode,
      priceId: adPackage.stripePriceId,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      customerId: advertiser.stripeCustomerId,
      customerEmail: advertiser.contactEmail,
      allowPromotionCodes: true,
      promotionCodeId,
      idempotencyKey: `ad-checkout:${advertiser._id.toString()}:${adPackage._id.toString()}`,
      metadata: {
        flow: 'advertiser_package_checkout',
        advertiserAccountId: advertiser._id.toString(),
        adPackageId: adPackage._id.toString(),
        adPackageKey: adPackage.key,
        ownerUserId: userObjectId.toString(),
        ...(input.couponCode ? { couponCode: input.couponCode } : {})
      }
    });

    const sessionCustomerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer && typeof session.customer === 'object' && 'id' in session.customer
          ? (session.customer.id as string)
          : undefined;

    if (sessionCustomerId && sessionCustomerId !== advertiser.stripeCustomerId) {
      advertiser.stripeCustomerId = sessionCustomerId;
      await advertiser.save();
    }

    return {
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
      mode,
      package: this.toAdPackage(adPackage),
      advertiser: {
        id: advertiser._id.toString(),
        status: advertiser.status,
        stripeCustomerId: advertiser.stripeCustomerId
      }
    };
  }

  public async getAdvertiserSubscription(userId: string) {
    const userObjectId = this.toObjectId(userId, 'Invalid user id');
    const advertiser = await AdvertiserAccountModel.findOne({ ownerUserId: userObjectId }).lean();

    if (!advertiser) {
      return {
        hasAccount: false
      };
    }

    const activePackage =
      advertiser.activePackageId && Types.ObjectId.isValid(advertiser.activePackageId.toString())
        ? await AdPackageModel.findById(advertiser.activePackageId).lean()
        : null;

    let stripeSubscription: Record<string, unknown> | null = null;
    if (advertiser.stripeSubscriptionId && this.stripeService.isConfigured()) {
      try {
        const subscription = await this.stripeService.getSubscription(advertiser.stripeSubscriptionId);
        const currentPeriodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
        stripeSubscription = {
          id: subscription.id,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: typeof currentPeriodEnd === 'number' ? new Date(currentPeriodEnd * 1000).toISOString() : undefined
        };
      } catch {
        stripeSubscription = {
          id: advertiser.stripeSubscriptionId,
          status: 'unknown'
        };
      }
    }

    return {
      hasAccount: true,
      advertiser: {
        id: advertiser._id.toString(),
        displayName: advertiser.displayName,
        contactEmail: advertiser.contactEmail,
        status: advertiser.status,
        affiliateCode: advertiser.affiliateCode,
        monthlyBudgetUsd: advertiser.monthlyBudgetUsd,
        stripeCustomerId: advertiser.stripeCustomerId,
        stripeSubscriptionId: advertiser.stripeSubscriptionId,
        billingStatus: advertiser.billingStatus,
        lastInvoiceStatus: advertiser.lastInvoiceStatus,
        lastInvoiceAt: advertiser.lastInvoiceAt,
        failedPaymentCount: advertiser.failedPaymentCount
      },
      activePackage: activePackage ? this.toAdPackage(activePackage) : null,
      stripeSubscription
    };
  }

  public async runBlogAutomationSweep(input?: { queueLimit?: number; jobLimit?: number }) {
    const now = new Date();
    const queueLimit = Math.max(1, Math.min(500, Number(input?.queueLimit || 50)));
    const jobLimit = Math.max(1, Math.min(200, Number(input?.jobLimit || 25)));

    const queueResult = await this.enqueueSeoRefreshQueue({ limit: queueLimit });

    const autoPublishResult = await BlogPostModel.updateMany(
      {
        state: 'qa_passed',
        contentRisk: 'low_risk_update',
        $or: [{ scheduledAt: { $exists: false } }, { scheduledAt: null }, { scheduledAt: { $lte: now } }]
      },
      {
        $set: {
          state: 'published',
          publishedAt: now,
          lastReviewedAt: now,
          lastUpdatedAt: now
        }
      }
    );

    const jobs = await BlogJobModel.find({ status: 'queued' }).sort({ createdAt: 1 }).limit(jobLimit);
    let completedJobs = 0;
    let failedJobs = 0;
    let refreshedPosts = 0;

    for (const job of jobs) {
      job.status = 'running';
      job.startedAt = new Date();
      await job.save();

      try {
        if (job.type === 'refresh_content' && job.postId) {
          const post = await BlogPostModel.findById(job.postId);
          if (post) {
            const refreshedBody = this.buildRefreshedBlogBody(post.body, post.cluster, (job.payload?.reviewNotes as string) || undefined);
            const qa = this.scoreBlogQa({
              title: post.title,
              body: refreshedBody,
              sourceLinks: this.extractLinks(refreshedBody)
            });

            post.body = refreshedBody;
            post.sourceLinks = this.extractLinks(refreshedBody);
            post.qaPassed = qa.passed;
            post.qaScore = this.qaScoreFromQa(qa);
            post.factCheckConfidence = qa.factCheckConfidence;
            post.duplicationScore = qa.duplicationScore;
            post.readabilityScore = qa.readabilityScore;
            post.linkValidationPassed = qa.linkValidationPassed;
            post.schemaValidationPassed = qa.schemaValidationPassed;
            post.lastUpdatedAt = new Date();

            if (!qa.passed) {
              post.state = 'pending_review';
            } else if (post.state === 'published') {
              post.lastReviewedAt = post.lastReviewedAt || new Date();
            } else if (post.contentRisk === 'low_risk_update') {
              post.state = 'qa_passed';
            } else {
              post.state = 'pending_review';
            }

            const qaReport = await BlogQaReportModel.create({
              postId: post._id,
              factCheckConfidence: qa.factCheckConfidence,
              duplicationScore: qa.duplicationScore,
              readabilityScore: qa.readabilityScore,
              linkValidationPassed: qa.linkValidationPassed,
              schemaValidationPassed: qa.schemaValidationPassed,
              passed: qa.passed,
              warnings: qa.warnings
            });

            post.qaReportId = qaReport._id;
            await post.save();
            refreshedPosts += 1;
            job.result = {
              postId: post._id.toString(),
              state: post.state,
              qaPassed: qa.passed,
              qaScore: post.qaScore
            };
          } else {
            job.result = {
              postId: job.postId.toString(),
              status: 'skipped',
              reason: 'post_not_found'
            };
          }
        } else {
          job.result = {
            status: 'skipped',
            reason: 'no_refresh_action'
          };
        }

        job.status = 'completed';
        job.error = undefined;
        job.finishedAt = new Date();
        await job.save();
        completedJobs += 1;
      } catch (error) {
        failedJobs += 1;
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : 'Unknown job error';
        job.finishedAt = new Date();
        await job.save();
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      queuedRefreshJobs: queueResult.queued,
      skippedRefreshJobs: queueResult.skipped,
      autoPublishedPosts: Number(autoPublishResult.modifiedCount || 0),
      processedJobs: jobs.length,
      completedJobs,
      failedJobs,
      refreshedPosts
    };
  }

  public async runDeckReviewSweep(input?: { limit?: number }) {
    const now = new Date();
    const limit = Math.max(1, Math.min(1000, Number(input?.limit || 200)));
    const dueEvents = await DeckReviewEventModel.find({
      nextReviewAt: { $lte: now },
      eventType: { $in: ['add', 'review'] }
    })
      .sort({ nextReviewAt: 1 })
      .limit(limit);

    let processed = 0;
    for (const event of dueEvents) {
      const currentInterval = Math.max(1, Number(event.intervalDays || 1));
      const nextInterval = Math.min(60, Math.max(1, Math.round(currentInterval * 1.8)));
      const nextReviewAt = new Date(now.getTime() + nextInterval * 24 * 60 * 60 * 1000);

      event.eventType = 'review';
      event.intervalDays = nextInterval;
      event.nextReviewAt = nextReviewAt;
      event.metadata = {
        ...(event.metadata || {}),
        scheduler: 'growth_deck_v1',
        schedulerUpdatedAt: now.toISOString()
      };
      await event.save();
      processed += 1;
    }

    return {
      generatedAt: now.toISOString(),
      processed,
      remainingDue: Math.max(0, dueEvents.length - processed)
    };
  }

  public async handleAdvertiserStripeWebhook(event: Stripe.Event) {
    const supportedTypes = new Set([
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.paid',
      'invoice.payment_failed'
    ]);

    if (!supportedTypes.has(event.type)) {
      return { handled: false, reason: 'unsupported_event' as const };
    }

    const existing = await ProcessedWebhookEvent.findOne({ provider: 'stripe', eventId: event.id }).lean();
    const alreadyHandled = Boolean((existing?.metadata as Record<string, unknown> | undefined)?.advertiserHandled);
    if (alreadyHandled) {
      return { handled: false, reason: 'already_processed' as const };
    }

    let advertiser: any | null = null;

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.flow !== 'advertiser_package_checkout') {
        return { handled: false, reason: 'non_advertiser_checkout' as const };
      }

      const customerId = this.resolveStripeCustomerId(session.customer);
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription && typeof session.subscription === 'object' && 'id' in session.subscription
            ? (session.subscription.id as string)
            : undefined;

      advertiser = await this.resolveAdvertiserAccountForWebhook({
        advertiserAccountId: session.metadata?.advertiserAccountId,
        ownerUserId: session.metadata?.ownerUserId,
        customerId,
        customerEmail: session.customer_details?.email || session.customer_email || undefined
      });

      if (!advertiser) {
        this.log.warn(`Advertiser webhook checkout ignored; account not found for event ${event.id}`);
        return { handled: false, reason: 'advertiser_not_found' as const };
      }

      if (customerId) advertiser.stripeCustomerId = customerId;
      if (subscriptionId) advertiser.stripeSubscriptionId = subscriptionId;
      if (session.metadata?.adPackageId && Types.ObjectId.isValid(session.metadata.adPackageId)) {
        advertiser.activePackageId = new Types.ObjectId(session.metadata.adPackageId);
      }
      advertiser.status = 'active';
      advertiser.billingStatus = session.mode === 'subscription' ? 'active' : advertiser.billingStatus || 'active';
      advertiser.failedPaymentCount = 0;
      await advertiser.save();
    } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = this.resolveStripeCustomerId(subscription.customer);
      advertiser = await this.resolveAdvertiserAccountForWebhook({
        advertiserAccountId: subscription.metadata?.advertiserAccountId,
        ownerUserId: subscription.metadata?.ownerUserId,
        customerId
      });

      if (!advertiser) {
        this.log.warn(`Advertiser subscription webhook ignored; account not found for event ${event.id}`);
        return { handled: false, reason: 'advertiser_not_found' as const };
      }

      if (customerId) advertiser.stripeCustomerId = customerId;
      advertiser.stripeSubscriptionId = subscription.id;
      advertiser.status = this.toAdvertiserStatusFromStripeSubscription(subscription.status);
      advertiser.billingStatus = this.toAdvertiserBillingStatusFromSubscription(subscription.status);
      if (subscription.metadata?.adPackageId && Types.ObjectId.isValid(subscription.metadata.adPackageId)) {
        advertiser.activePackageId = new Types.ObjectId(subscription.metadata.adPackageId);
      }
      await advertiser.save();
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = this.resolveStripeCustomerId(subscription.customer);
      advertiser = await this.resolveAdvertiserAccountForWebhook({
        advertiserAccountId: subscription.metadata?.advertiserAccountId,
        ownerUserId: subscription.metadata?.ownerUserId,
        customerId
      });

      if (!advertiser) {
        return { handled: false, reason: 'advertiser_not_found' as const };
      }

      advertiser.stripeSubscriptionId = undefined;
      advertiser.status = 'cancelled';
      advertiser.billingStatus = 'canceled';
      await advertiser.save();
    } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = this.resolveStripeCustomerId(invoice.customer as any);
      advertiser = await this.resolveAdvertiserAccountForWebhook({
        advertiserAccountId: invoice.metadata?.advertiserAccountId,
        ownerUserId: invoice.metadata?.ownerUserId,
        customerId,
        customerEmail: invoice.customer_email || undefined
      });

      if (!advertiser) {
        return { handled: false, reason: 'advertiser_not_found' as const };
      }

      const rawInvoice = invoice as unknown as { subscription?: string | { id?: string } };
      const subscriptionId =
        typeof rawInvoice.subscription === 'string'
          ? rawInvoice.subscription
          : rawInvoice.subscription && typeof rawInvoice.subscription === 'object' && 'id' in rawInvoice.subscription
            ? (rawInvoice.subscription.id as string)
            : undefined;

      if (customerId) advertiser.stripeCustomerId = customerId;
      if (subscriptionId) advertiser.stripeSubscriptionId = subscriptionId;
      advertiser.lastInvoiceId = invoice.id;
      advertiser.lastInvoiceStatus = invoice.status || (event.type === 'invoice.payment_failed' ? 'payment_failed' : 'paid');
      advertiser.lastInvoiceAt = new Date();

      if (event.type === 'invoice.payment_failed') {
        advertiser.status = 'suspended';
        advertiser.billingStatus = this.toAdvertiserBillingStatusFromInvoice(invoice.status);
        advertiser.failedPaymentCount = Math.max(0, Number(advertiser.failedPaymentCount || 0)) + 1;
      } else {
        advertiser.status = 'active';
        advertiser.billingStatus = this.toAdvertiserBillingStatusFromInvoice(invoice.status) || 'active';
        advertiser.failedPaymentCount = 0;
      }

      await advertiser.save();
    }

    await this.markAdvertiserWebhookHandled(event, {
      advertiserHandled: true,
      advertiserAccountId: advertiser?._id?.toString()
    });

    return {
      handled: true,
      advertiserAccountId: advertiser?._id?.toString()
    };
  }

  private async markAdvertiserWebhookHandled(event: Stripe.Event, metadata: Record<string, unknown>) {
    const existing = await ProcessedWebhookEvent.findOne({ provider: 'stripe', eventId: event.id });
    const mergedMetadata = {
      ...(existing?.metadata || {}),
      ...metadata,
      advertiserHandledAt: new Date().toISOString()
    };

    try {
      await ProcessedWebhookEvent.findOneAndUpdate(
        { provider: 'stripe', eventId: event.id },
        {
          $set: {
            eventType: event.type,
            processedAt: new Date(),
            metadata: mergedMetadata
          },
          $setOnInsert: {
            provider: 'stripe',
            eventId: event.id
          }
        },
        {
          new: true,
          upsert: true
        }
      );
    } catch (error: any) {
      if (error?.code !== 11000) {
        throw error;
      }

      await ProcessedWebhookEvent.findOneAndUpdate(
        { provider: 'stripe', eventId: event.id },
        {
          $set: {
            eventType: event.type,
            processedAt: new Date(),
            metadata: mergedMetadata
          }
        },
        {
          new: true
        }
      );
    }
  }

  private resolveStripeCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined) {
    if (!customer) return undefined;
    if (typeof customer === 'string') return customer;
    return customer.id;
  }

  private toAdvertiserStatusFromStripeSubscription(status: Stripe.Subscription.Status) {
    if (status === 'active' || status === 'trialing') return 'active' as const;
    if (status === 'canceled') return 'cancelled' as const;
    if (status === 'past_due' || status === 'incomplete' || status === 'incomplete_expired' || status === 'unpaid') {
      return 'suspended' as const;
    }
    return 'pending' as const;
  }

  private toAdvertiserBillingStatusFromSubscription(status: Stripe.Subscription.Status) {
    if (status === 'trialing') return 'trialing' as const;
    if (status === 'active') return 'active' as const;
    if (status === 'past_due') return 'past_due' as const;
    if (status === 'unpaid') return 'unpaid' as const;
    if (status === 'canceled') return 'canceled' as const;
    return 'unknown' as const;
  }

  private toAdvertiserBillingStatusFromInvoice(status: Stripe.Invoice.Status | null | undefined) {
    if (status === 'paid') return 'active' as const;
    if (status === 'open') return 'past_due' as const;
    if (status === 'void') return 'canceled' as const;
    if (status === 'uncollectible') return 'unpaid' as const;
    return 'unknown' as const;
  }

  private async resolveAdvertiserAccountForWebhook(input: {
    advertiserAccountId?: string;
    ownerUserId?: string;
    customerId?: string;
    customerEmail?: string;
  }) {
    if (input.advertiserAccountId && Types.ObjectId.isValid(input.advertiserAccountId)) {
      const byId = await AdvertiserAccountModel.findById(input.advertiserAccountId);
      if (byId) return byId;
    }

    if (input.ownerUserId && Types.ObjectId.isValid(input.ownerUserId)) {
      const ownerObjectId = new Types.ObjectId(input.ownerUserId);
      const byOwner = await AdvertiserAccountModel.findOne({ ownerUserId: ownerObjectId });
      if (byOwner) return byOwner;

      const owner = await UserModel.findById(ownerObjectId).lean();
      if (owner) {
        return AdvertiserAccountModel.create({
          ownerUserId: ownerObjectId,
          displayName: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email,
          contactEmail: owner.email,
          status: 'pending',
          stripeCustomerId: input.customerId
        });
      }
    }

    if (input.customerId) {
      const byCustomer = await AdvertiserAccountModel.findOne({ stripeCustomerId: input.customerId });
      if (byCustomer) return byCustomer;
    }

    if (input.customerEmail) {
      const byEmail = await AdvertiserAccountModel.findOne({ contactEmail: input.customerEmail.trim().toLowerCase() });
      if (byEmail) return byEmail;
    }

    return null;
  }

  private buildRefreshedBlogBody(body: string, cluster: string, reviewNotes?: string) {
    const cleanedBody = body.trim();
    const refreshStamp = `\n\n---\n\n_Refreshed on ${new Date().toISOString().slice(0, 10)} for ${cluster} freshness cycle._`;
    const notesBlock = reviewNotes?.trim()
      ? `\n\n### Editor Refresh Notes\n\n${reviewNotes
          .trim()
          .split('\n')
          .map(line => (line.startsWith('- ') ? line : `- ${line}`))
          .join('\n')}`
      : '';

    return `${cleanedBody}${notesBlock}${refreshStamp}`.slice(0, 50000);
  }

  private buildLibraryFilter(query: LibraryQuery) {
    const filter: Record<string, unknown> = { active: true };
    if (query.search) {
      const escaped = this.escapeRegex(query.search.trim());
      filter.$or = [
        { phrase: { $regex: escaped, $options: 'i' } },
        { meaning: { $regex: escaped, $options: 'i' } },
        { lemma: { $regex: escaped, $options: 'i' } },
        { definition: { $regex: escaped, $options: 'i' } },
        { title: { $regex: escaped, $options: 'i' } }
      ];
    }
    if (query.topic) filter.topic = { $regex: this.escapeRegex(query.topic.trim()), $options: 'i' };
    if (query.module) filter.module = query.module;
    if (query.cefr) {
      filter.cefr = query.cefr;
    } else if (query.difficulty) {
      const cefrMap: Record<string, string[]> = {
        beginner: ['A2', 'B1'],
        intermediate: ['B2'],
        advanced: ['C1', 'C2']
      };
      const cefrValues = cefrMap[query.difficulty];
      if (cefrValues) filter.cefr = { $in: cefrValues };
    }
    return filter;
  }

  private toCriterion(
    key: string,
    module: 'speaking' | 'writing' | 'reading' | 'listening',
    label: string,
    series: Array<{ x: string; y: number }>
  ) {
    const points = series.filter(item => Number.isFinite(item.y) && item.y > 0);
    const dataPoints = points.length;
    const averageScore = dataPoints ? this.round(points.reduce((sum, item) => sum + item.y, 0) / dataPoints, 2) : 0;
    const confidence = this.confidenceFromDataPoints(dataPoints);
    const confidenceWidth = dataPoints >= 20 ? 0.35 : dataPoints >= 10 ? 0.55 : 0.9;

    return {
      key,
      module,
      label,
      averageScore,
      dataPoints,
      confidence,
      confidenceBand: {
        low: this.round(Math.max(0, averageScore - confidenceWidth), 2),
        high: this.round(Math.min(9, averageScore + confidenceWidth), 2)
      },
      trend: points.slice(-12)
    };
  }

  private recommendedAction(module: string, criterionLabel: string) {
    const moduleLabel = module.charAt(0).toUpperCase() + module.slice(1);
    return `Focus on ${criterionLabel.toLowerCase()} with 3 targeted ${moduleLabel} sessions this week and review feedback before the next mock.`;
  }

  private moduleDeepLink(module: string) {
    if (module === 'speaking') return '/app/speaking';
    if (module === 'writing') return '/app/writing';
    if (module === 'reading') return '/app/reading';
    return '/app/listening';
  }

  private predictionConfidenceFromCards(cardCount: number, sufficiency: 'low' | 'medium' | 'high') {
    if (cardCount === 0 || sufficiency === 'low') return 'low';
    if (sufficiency === 'high' && cardCount >= 2) return 'high';
    return 'medium';
  }

  private qaScoreFromQa(qa: BlogQa) {
    const weighted = qa.factCheckConfidence * 35 + (1 - qa.duplicationScore) * 25 + (qa.readabilityScore / 100) * 20;
    const linkScore = qa.linkValidationPassed ? 10 : 0;
    const schemaScore = qa.schemaValidationPassed ? 10 : 0;
    return this.round(weighted + linkScore + schemaScore, 2);
  }

  private scoreBlogQa(params: { title: string; body: string; sourceLinks: string[] }): BlogQa {
    const wordCount = params.body.split(/\s+/).filter(Boolean).length;
    const factCheckConfidence = this.round(
      Math.min(0.98, 0.52 + Math.min(0.24, params.sourceLinks.length * 0.08) + (wordCount >= 600 ? 0.08 : 0)),
      2
    );
    const duplicationScore = this.round(Math.max(0.05, 0.42 - Math.min(0.18, wordCount / 5000)), 2);
    const readabilityScore = this.round(Math.min(100, 52 + Math.min(42, wordCount / 20)), 1);
    const linkValidationPassed = params.sourceLinks.length > 0;
    const schemaValidationPassed = Boolean(params.title.trim().length >= 8 && params.body.trim().length >= 150);

    const warnings: string[] = [];
    if (!linkValidationPassed) warnings.push('Missing trusted source links');
    if (factCheckConfidence < 0.7) warnings.push('Fact-check confidence below threshold');
    if (duplicationScore > 0.35) warnings.push('Potential duplication risk is high');
    if (readabilityScore < 60) warnings.push('Readability score below threshold');
    if (!schemaValidationPassed) warnings.push('Schema validation requirements not met');

    const passed =
      factCheckConfidence >= 0.7 &&
      duplicationScore <= 0.35 &&
      readabilityScore >= 60 &&
      linkValidationPassed &&
      schemaValidationPassed;

    return {
      factCheckConfidence,
      duplicationScore,
      readabilityScore,
      linkValidationPassed,
      schemaValidationPassed,
      passed,
      warnings
    };
  }

  private validateAdCreative(input: { headline: string; ctaUrl?: string }) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.headline.trim()) {
      errors.push('Headline is required');
    }
    if (input.headline.length > 120) {
      errors.push('Headline exceeds 120 characters');
    }
    if (input.ctaUrl && !/^https?:\/\//i.test(input.ctaUrl)) {
      errors.push('CTA URL must start with http:// or https://');
    }
    if (input.headline.length < 24) {
      warnings.push('Headline may be too short for strong CTR');
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  private async ensureTopicClusters(): Promise<TopicCluster[]> {
    const existing = (await BlogTopicClusterModel.find({}).sort({ priority: 1 }).lean()) as TopicCluster[];
    if (existing.length) {
      return existing;
    }

    const defaults = [
      {
        key: 'speaking',
        name: 'Speaking',
        description: 'Fluency, pronunciation, and speaking strategies',
        priority: 10,
        active: true,
        refreshCadenceDays: 21
      },
      {
        key: 'writing',
        name: 'Writing',
        description: 'Task response, coherence, and writing structure',
        priority: 20,
        active: true,
        refreshCadenceDays: 21
      },
      {
        key: 'reading',
        name: 'Reading',
        description: 'Comprehension, skimming, and question strategies',
        priority: 30,
        active: true,
        refreshCadenceDays: 28
      },
      {
        key: 'listening',
        name: 'Listening',
        description: 'Listening tactics, note-taking, and focus patterns',
        priority: 40,
        active: true,
        refreshCadenceDays: 28
      },
      {
        key: 'vocabulary-collocations',
        name: 'Vocabulary & Collocations',
        description: 'Lexical resource growth and collocation usage',
        priority: 50,
        active: true,
        refreshCadenceDays: 30
      },
      {
        key: 'exam-strategy',
        name: 'Exam Strategy',
        description: 'Time management, scoring strategy, and mock prep',
        priority: 60,
        active: true,
        refreshCadenceDays: 35
      },
      {
        key: 'institutions-coaches',
        name: 'Institutions & Coaches',
        description: 'Guides for schools, institutes, and IELTS coaches',
        priority: 70,
        active: true,
        refreshCadenceDays: 45
      }
    ];

    await BlogTopicClusterModel.insertMany(defaults, { ordered: false });
    return (await BlogTopicClusterModel.find({}).sort({ priority: 1 }).lean()) as TopicCluster[];
  }

  private generateBlogIdeaTitle(clusterName: string, index: number) {
    const templates = [
      'How to improve {cluster} score in 30 days',
      'Top mistakes learners make in {cluster} and how to fix them',
      'Band-7 strategy checklist for {cluster}',
      'Weekly practice plan for {cluster}',
      'What changed in IELTS prep for {cluster} this year'
    ];
    const template = templates[(index - 1) % templates.length];
    return template.replace('{cluster}', clusterName.toLowerCase());
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private toBlogSummary(row: any) {
    return {
      id: row._id.toString(),
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      cluster: row.cluster,
      tags: row.tags || [],
      state: row.state,
      contentRisk: row.contentRisk,
      qaPassed: row.qaPassed,
      qaScore: row.qaScore,
      publishedAt: row.publishedAt,
      lastReviewedAt: row.lastReviewedAt,
      lastUpdatedAt: row.lastUpdatedAt || row.updatedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  private toBlogDetail(row: any) {
    return {
      ...this.toBlogSummary(row),
      body: row.body,
      sourceLinks: row.sourceLinks || [],
      qaReportId: row.qaReportId ? row.qaReportId.toString() : undefined
    };
  }

  private toAdPackage(row: any) {
    return {
      id: row._id.toString(),
      key: row.key,
      name: row.name,
      description: row.description,
      placementType: row.placementType,
      billingType: row.billingType,
      stripePriceId: row.stripePriceId,
      currency: row.currency,
      priceAmount: row.priceAmount,
      features: row.features || [],
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  private toObjectId(value: string, message: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, message);
    }
    return new Types.ObjectId(value);
  }

  private resolveRange(rangeInput?: string): { key: GrowthRange; from: Date; to: Date } {
    const key: GrowthRange = rangeInput === '7d' || rangeInput === '90d' ? rangeInput : '30d';
    const days = key === '7d' ? 7 : key === '90d' ? 90 : 30;
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    return { key, from, to };
  }

  private confidenceFromDataPoints(points: number): 'low' | 'medium' | 'high' {
    if (points >= 18) return 'high';
    if (points >= 8) return 'medium';
    return 'low';
  }

  private dataSufficiencyLevel(points: number): 'low' | 'medium' | 'high' {
    if (points >= 30) return 'high';
    if (points >= 12) return 'medium';
    return 'low';
  }

  private extractLinks(text: string) {
    const matches = text.match(/https?:\/\/[^\s)]+/gi) || [];
    return Array.from(new Set(matches.map(item => item.trim())));
  }

  private async ensureUniqueSlug(base: string) {
    const normalizedBase = base || `blog-${Date.now()}`;
    let slug = normalizedBase;
    let suffix = 1;
    // Ensure uniqueness even on repeated title generation.
    while (await BlogPostModel.findOne({ slug }).lean()) {
      suffix += 1;
      slug = `${normalizedBase}-${suffix}`;
    }
    return slug;
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/['’"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || `post-${Date.now()}`;
  }

  private toDifficulty(cefr: string) {
    if (cefr === 'A2' || cefr === 'B1') return 'beginner';
    if (cefr === 'B2') return 'intermediate';
    return 'advanced';
  }

  private resolvePagination(limitInput?: number, offsetInput?: number, defaultLimit = 20, defaultOffset = 0, maxLimit = 200) {
    const limit = Math.max(1, Math.min(maxLimit, Number.isFinite(limitInput) ? Number(limitInput) : defaultLimit));
    const offset = Math.max(0, Number.isFinite(offsetInput) ? Number(offsetInput) : defaultOffset);
    return { limit, offset };
  }

  private round(value: number, decimals = 2) {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
}
