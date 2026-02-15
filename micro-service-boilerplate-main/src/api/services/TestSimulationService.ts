import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { env } from '@env';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Service } from 'typedi';

import { FeedbackService } from './FeedbackService';
import { AnalyticsService } from './AnalyticsService';
import { QuestionGenerationService } from './QuestionGenerationService';
import { UsageService } from './UsageService';
import { TestType } from '../models/TestHistory';

type SubscriptionPlan = 'free' | 'premium' | 'pro';

interface SimulationPartDefinition {
  part: number;
  topicId: string;
  topicTitle: string;
  question: string;
  timeLimit: number;
  tips: string[];
}

interface SimulationListOptions {
  limit: number;
  offset: number;
}

type SimulationRow = {
  id: string;
  user_id: string;
  status: 'in_progress' | 'completed';
  parts: any[];
  overall_feedback: any | null;
  overall_band: number | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

@Service()
export class TestSimulationService {
  private log = new Logger(__filename);

  constructor(
    private readonly usageService: UsageService,
    private readonly feedbackService: FeedbackService,
    private readonly questionGenerationService: QuestionGenerationService,
    private readonly analyticsService: AnalyticsService
  ) {}

  public paginateOptions(limit?: number, offset?: number) {
    return {
      limit: typeof limit === 'number' && limit > 0 ? Math.min(limit, 50) : 10,
      offset: typeof offset === 'number' && offset >= 0 ? offset : 0
    };
  }

  private mapSimulation(row: SimulationRow) {
    return {
      _id: row.id,
      status: row.status,
      parts: Array.isArray(row.parts) ? row.parts : [],
      overallFeedback: row.overall_feedback || undefined,
      overallBand: row.overall_band ?? undefined,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async startSimulation(userId: string, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'startSimulation', headers);
    const supabase = getSupabaseAdmin();

    const { data: profile } = await supabase.from('profiles').select('subscription_plan').eq('id', userId).maybeSingle();
    const plan = ((profile as any)?.subscription_plan as SubscriptionPlan | undefined) || 'free';
    const effectivePlan: SubscriptionPlan = env.payments?.disabled ? 'pro' : plan;

    await this.usageService.assertTestAllowance(userId, effectivePlan, headers);
    await this.usageService.incrementTest(userId);

    const parts = await this.buildSimulationParts(userId, headers);

    const { data: inserted, error } = await supabase
      .from('test_simulations')
      .insert({
        user_id: userId,
        status: 'in_progress',
        parts: parts.map(part => ({
          part: part.part,
          question: part.question,
          topicId: part.topicId,
          topicTitle: part.topicTitle,
          timeLimit: part.timeLimit,
          tips: part.tips,
          response: undefined,
          timeSpent: undefined,
          feedback: undefined
        })),
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error || !inserted) {
      this.log.error(`${logMessage} :: Failed to start simulation`, { error: error?.message || error });
      throw new CSError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, CODES.GenericErrorMessage, 'Failed to start simulation');
    }

    this.log.info(`${logMessage} :: Started simulation ${inserted.id}`);

    return {
      simulationId: inserted.id,
      parts
    };
  }

  public async completeSimulation(
    userId: string,
    simulationId: string,
    partsPayload: {
      part: number;
      question: string;
      response?: string;
      timeSpent?: number;
    }[],
    headers: IRequestHeaders
  ) {
    const logMessage = constructLogMessage(__filename, 'completeSimulation', headers);
    const supabase = getSupabaseAdmin();

    const { data: simulation, error } = await supabase
      .from('test_simulations')
      .select(
        'id, user_id, status, parts, overall_feedback, overall_band, started_at, completed_at, created_at, updated_at'
      )
      .eq('id', simulationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !simulation) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Simulation not found');
    }

    const row = simulation as SimulationRow;
    if (row.status === 'completed') {
      return this.mapSimulation(row);
    }

    const { data: pref } = await supabase.from('preferences').select('target_band').eq('user_id', userId).maybeSingle();
    const targetBand = (pref as any)?.target_band as string | undefined;

    const existingParts = Array.isArray(row.parts) ? [...row.parts] : [];
    const partMap = new Map<number, any>(existingParts.map((p: any) => [p.part, p]));

    const feedbackResults: any[] = [];
    for (const payload of partsPayload) {
      const part = partMap.get(payload.part);
      if (!part) {
        throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, `Unknown part ${payload.part}`);
      }

      part.response = payload.response;
      part.timeSpent = payload.timeSpent;

      const feedback = await this.feedbackService.generatePracticeFeedback(
        part.question,
        payload.response || '',
        targetBand,
        headers
      );

      part.feedback = {
        overallBand: feedback.scores.overallBand,
        bandBreakdown: {
          pronunciation: feedback.scores.pronunciation,
          fluency: feedback.scores.fluency,
          lexicalResource: feedback.scores.lexicalResource,
          grammaticalRange: feedback.scores.grammaticalRange
        },
        summary: feedback.summary,
        strengths: feedback.strengths,
        improvements: feedback.improvements,
        generatedAt: new Date().toISOString(),
        model: feedback.model,
        fluencyAnalysis: feedback.fluencyAnalysis,
        pronunciationAnalysis: feedback.pronunciationAnalysis,
        lexicalAnalysis: feedback.lexicalAnalysis,
        grammaticalAnalysis: feedback.grammaticalAnalysis,
        coherenceCohesion: feedback.coherenceCohesion
      };

      feedbackResults.push(part.feedback);
    }

    const aggregated = this.aggregateFeedback(feedbackResults);

    const { data: updated, error: updateError } = await supabase
      .from('test_simulations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        parts: existingParts,
        overall_feedback: aggregated,
        overall_band: aggregated.overallBand ?? null
      })
      .eq('id', simulationId)
      .eq('user_id', userId)
      .select(
        'id, user_id, status, parts, overall_feedback, overall_band, started_at, completed_at, created_at, updated_at'
      )
      .single();

    if (updateError || !updated) {
      this.log.error(`${logMessage} :: Failed to complete simulation ${simulationId}`, {
        error: updateError?.message || updateError
      });
      throw new CSError(
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        CODES.GenericErrorMessage,
        'Failed to complete simulation'
      );
    }

    this.log.info(`${logMessage} :: Completed simulation ${simulationId}`);
    // Best-effort persist to analytics history for progress snapshot + trends.
    try {
      const breakdown = aggregated?.bandBreakdown || {};
      const criteria = {
        fluencyCoherence: { band: Number(breakdown.fluency || 0), feedback: '', strengths: [], improvements: [] },
        lexicalResource: { band: Number(breakdown.lexicalResource || 0), feedback: '', strengths: [], improvements: [] },
        grammaticalRange: { band: Number(breakdown.grammaticalRange || 0), feedback: '', strengths: [], improvements: [] },
        pronunciation: { band: Number(breakdown.pronunciation || 0), feedback: '', strengths: [], improvements: [] }
      };

      const durationSeconds = existingParts
        .map((p: any) => Number(p?.timeSpent || 0))
        .reduce((sum: number, n: number) => sum + (Number.isFinite(n) ? n : 0), 0);

      const topics = existingParts
        .map((p: any) => (typeof p?.topicTitle === 'string' ? p.topicTitle : undefined))
        .filter(Boolean);

      await this.analyticsService.saveTestResult({
        userId,
        sessionId: simulationId,
        testType: TestType.SIMULATION,
        topic: 'Full Simulation',
        testPart: 'full',
        durationSeconds: Math.max(0, Math.round(durationSeconds)),
        completedAt: new Date(),
        overallBand: Number(aggregated?.overallBand || 0),
        criteria,
        corrections: [],
        suggestions: Array.isArray(aggregated?.improvements) ? aggregated.improvements : [],
        metadata: {
          source: 'test_simulation',
          topics
        }
      });
    } catch (analyticsError: any) {
      this.log.warn(`${logMessage} :: Failed to persist analytics for simulation`, {
        simulationId,
        error: analyticsError?.message || analyticsError
      });
    }

    return this.mapSimulation(updated as SimulationRow);
  }

  public async listSimulations(userId: string, options: SimulationListOptions) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('test_simulations')
      .select('id, user_id, status, parts, overall_feedback, overall_band, started_at, completed_at, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(Math.max(0, options.offset), Math.max(0, options.offset) + Math.max(1, options.limit) - 1);

    if (error) {
      throw error;
    }

    return ((data || []) as SimulationRow[]).map(row => this.mapSimulation(row));
  }

  public async getSimulation(userId: string, simulationId: string) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('test_simulations')
      .select('id, user_id, status, parts, overall_feedback, overall_band, started_at, completed_at, created_at, updated_at')
      .eq('id', simulationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return this.mapSimulation(data as SimulationRow);
  }

  private async buildSimulationParts(userId: string, headers: IRequestHeaders): Promise<SimulationPartDefinition[]> {
    const logMessage = constructLogMessage(__filename, 'buildSimulationParts', headers);
    const supabase = getSupabaseAdmin();

    try {
      const { data: preferences } = await supabase.from('preferences').select('target_band').eq('user_id', userId).maybeSingle();
      const difficulty = this.determineDifficulty((preferences as any)?.target_band as string | undefined);

      const generatedTest = await this.questionGenerationService.generateCompleteTest(userId, difficulty, headers);

      const parts: SimulationPartDefinition[] = [];

      parts.push({
        part: 1,
        topicId: generatedTest.part1.topic,
        topicTitle: generatedTest.part1.topic,
        question: generatedTest.part1.questions.join('\n'),
        timeLimit: generatedTest.part1.timeLimit,
        tips: ['Keep answers brief (30-60 seconds)', 'Give specific examples', 'Speak naturally and confidently']
      });

      const cueCardText = `${generatedTest.part2.mainPrompt}\n\nYou should say:\n${generatedTest.part2.bulletPoints
        .map(bp => `• ${bp}`)
        .join('\n')}`;
      parts.push({
        part: 2,
        topicId: generatedTest.part2.topic,
        topicTitle: generatedTest.part2.topic,
        question: cueCardText,
        timeLimit: generatedTest.part2.preparationTime + generatedTest.part2.responseTime,
        tips: [
          'You have 1 minute to prepare',
          'Speak for 1-2 minutes',
          'Cover all bullet points',
          'Use linking words to connect ideas'
        ]
      });

      parts.push({
        part: 3,
        topicId: generatedTest.part3.topic,
        topicTitle: generatedTest.part3.topic,
        question: generatedTest.part3.questions.join('\n'),
        timeLimit: generatedTest.part3.timeLimit,
        tips: [
          'Give detailed, analytical answers',
          'Support opinions with reasons and examples',
          'Show range of vocabulary and grammar'
        ]
      });

      this.log.info(`${logMessage} :: Generated ${parts.length} AI-powered test parts`);
      return parts;
    } catch (error: any) {
      this.log.error(`${logMessage} :: AI generation failed, using fallback`, { error: error.message });
      return this.buildFallbackParts();
    }
  }

  private determineDifficulty(targetBand?: string): 'beginner' | 'intermediate' | 'advanced' {
    if (!targetBand) return 'intermediate';

    const band = parseFloat(targetBand);
    if (band >= 7) return 'advanced';
    if (band >= 5.5) return 'intermediate';
    return 'beginner';
  }

  private buildFallbackParts(): SimulationPartDefinition[] {
    return [
      {
        part: 1,
        topicId: 'general',
        topicTitle: 'About You',
        question:
          "Let's talk about your hometown. Where are you from?\nWhat do you like about living there?\nDo you work or are you a student?",
        timeLimit: 60,
        tips: ['Keep answers brief', 'Give specific examples']
      },
      {
        part: 2,
        topicId: 'memorable-event',
        topicTitle: 'A Memorable Event',
        question:
          'Describe a memorable event in your life.\n\nYou should say:\n• What the event was\n• When it happened\n• Who was there\n• And explain why it was memorable',
        timeLimit: 180,
        tips: ['Prepare for 1 minute', 'Speak for 1-2 minutes']
      },
      {
        part: 3,
        topicId: 'society',
        topicTitle: 'Events and Celebrations',
        question:
          'Why do people celebrate special events?\nHow have celebrations changed in your country?\nWhat is the role of social media in modern celebrations?',
        timeLimit: 90,
        tips: ['Give detailed answers', 'Support your opinions']
      }
    ];
  }

  private aggregateFeedback(feedbackList: any[]): any {
    if (!feedbackList.length) {
      return {
        overallBand: undefined,
        summary: 'No feedback available',
        strengths: [],
        improvements: []
      };
    }

    const sums = feedbackList.reduce(
      (
        acc,
        feedback
      ): {
        count: number;
        overall: number;
        pronunciation: number;
        fluency: number;
        lexical: number;
        grammar: number;
        strengths: Set<string>;
        improvements: Set<string>;
      } => {
        const overall = feedback.overallBand ?? 0;
        const breakdown = feedback.bandBreakdown || {};

        return {
          count: acc.count + 1,
          overall: acc.overall + overall,
          pronunciation: acc.pronunciation + (breakdown.pronunciation ?? overall),
          fluency: acc.fluency + (breakdown.fluency ?? overall),
          lexical: acc.lexical + (breakdown.lexicalResource ?? overall),
          grammar: acc.grammar + (breakdown.grammaticalRange ?? overall),
          strengths: new Set([...(acc.strengths || new Set<string>()), ...(feedback.strengths || [])]),
          improvements: new Set([...(acc.improvements || new Set<string>()), ...(feedback.improvements || [])])
        };
      },
      {
        count: 0,
        overall: 0,
        pronunciation: 0,
        fluency: 0,
        lexical: 0,
        grammar: 0,
        strengths: new Set<string>(),
        improvements: new Set<string>()
      }
    );

    const avg = (value: number) => (sums.count ? Math.round((value / sums.count) * 10) / 10 : 0);

    const overallBand = avg(sums.overall);
    return {
      overallBand,
      bandBreakdown: {
        pronunciation: avg(sums.pronunciation),
        fluency: avg(sums.fluency),
        lexicalResource: avg(sums.lexical),
        grammaticalRange: avg(sums.grammar)
      },
      summary: `Overall band estimate: ${overallBand}.`,
      strengths: Array.from(sums.strengths).slice(0, 8),
      improvements: Array.from(sums.improvements).slice(0, 8),
      generatedAt: new Date().toISOString()
    };
  }
}
