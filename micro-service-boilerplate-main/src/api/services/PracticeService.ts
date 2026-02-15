import { getPracticeQuestion } from '@api/data/practiceQuestions';
import { env } from '@env';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Service } from 'typedi';

import { TestType } from '../models/TestHistory';
import { AnalyticsService } from './AnalyticsService';
import { FeedbackService } from './FeedbackService';
import { TopicService } from './TopicService';
import { UsageService } from './UsageService';

type SubscriptionPlan = 'free' | 'premium' | 'pro';

type PracticeSessionRow = {
  id: string;
  user_id: string;
  topic_id: string | null;
  topic_title: string;
  question: string;
  source?: 'practice' | 'voice' | null;
  question_id?: string | null;
  audio_recording_id?: string | null;
  part: number;
  category: string | null;
  difficulty: string | null;
  status: 'in_progress' | 'completed';
  user_response: string | null;
  time_spent: number | null;
  feedback: any | null;
  transcription: any | null;
  audio_path: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type VoiceCompletePayload = {
  sessionId: string;
  questionId?: string;
  topicTitle: string;
  question: string;
  part: 1 | 2 | 3;
  difficulty?: 'easy' | 'medium' | 'hard';
  durationSeconds: number;
  transcript: string;
  evaluation: {
    overallBand: number;
    spokenSummary?: string;
    criteria: any;
    corrections?: any[];
    suggestions?: any[];
    bandComparison?: any;
  };
  audioRecordingId: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

@Service()
export class PracticeService {
  private log = new Logger(__filename);

  constructor(
    private readonly topicService: TopicService,
    private readonly usageService: UsageService,
    private readonly feedbackService: FeedbackService,
    private readonly analyticsService: AnalyticsService
  ) {}

  private toAnalyticsCriteriaFromStoredFeedback(storedFeedback: any): {
    fluencyCoherence: { band: number; feedback: string; strengths: string[]; improvements: string[] };
    lexicalResource: { band: number; feedback: string; strengths: string[]; improvements: string[] };
    grammaticalRange: { band: number; feedback: string; strengths: string[]; improvements: string[] };
    pronunciation: { band: number; feedback: string; strengths: string[]; improvements: string[] };
  } {
    const breakdown = storedFeedback?.bandBreakdown || {};

    return {
      fluencyCoherence: {
        band: Number(breakdown.fluency || 0),
        feedback:
          String(storedFeedback?.fluencyAnalysis?.assessment || storedFeedback?.coherenceCohesion?.assessment || '').trim(),
        strengths: [],
        improvements: []
      },
      lexicalResource: {
        band: Number(breakdown.lexicalResource || 0),
        feedback: String(storedFeedback?.lexicalAnalysis?.assessment || '').trim(),
        strengths: [],
        improvements: []
      },
      grammaticalRange: {
        band: Number(breakdown.grammaticalRange || 0),
        feedback: String(storedFeedback?.grammaticalAnalysis?.assessment || '').trim(),
        strengths: [],
        improvements: []
      },
      pronunciation: {
        band: Number(breakdown.pronunciation || 0),
        feedback: String(storedFeedback?.pronunciationAnalysis?.assessment || '').trim(),
        strengths: [],
        improvements: []
      }
    };
  }

  private getDefaultTips(part: number): string[] {
    switch (part) {
      case 1:
        return [
          'Give specific details in your answer',
          'Keep your response natural and conversational',
          'Aim for 1-2 minutes of speaking',
          'Use examples from your own experience'
        ];
      case 2:
        return [
          'Use the preparation time to organize your thoughts',
          'Speak for the full 2 minutes if possible',
          'Include specific details and personal feelings',
          'Follow the bullet points provided in the cue card'
        ];
      case 3:
        return [
          'Give balanced arguments for different viewpoints',
          'Support your opinions with clear reasons',
          'Use examples to illustrate your points',
          'Think about broader implications and future trends'
        ];
      default:
        return ['Speak clearly and naturally', 'Give detailed responses', 'Use examples to support your points'];
    }
  }

  private async resolveTopicSlug(topicId: string | null): Promise<string | undefined> {
    if (!topicId) return undefined;
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from('topics').select('slug').eq('id', topicId).maybeSingle();
    return (data as any)?.slug || undefined;
  }

  private async mapSession(row: PracticeSessionRow) {
    const topicSlug = await this.resolveTopicSlug(row.topic_id);
    return {
      _id: row.id,
      topicId: topicSlug || '',
      topicTitle: row.topic_title,
      question: row.question,
      source: row.source || 'practice',
      part: row.part,
      category: row.category || undefined,
      difficulty: row.difficulty || undefined,
      status: row.status,
      userResponse: row.user_response || undefined,
      timeSpent: row.time_spent || undefined,
      feedback: row.feedback || undefined,
      transcription: row.transcription || undefined,
      audioUrl: row.audio_recording_id ? `/audio/${row.audio_recording_id}` : undefined,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async startSession(userId: string, topicSlug: string, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'startSession', headers);

    // Plan is stored in profiles; default to free, but if payments are disabled, we treat as pro.
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase.from('profiles').select('subscription_plan').eq('id', userId).maybeSingle();
    const plan = ((profile as any)?.subscription_plan as SubscriptionPlan | undefined) || 'free';
    const effectivePlan: SubscriptionPlan = env.payments?.disabled ? 'pro' : plan;

    await this.usageService.assertPracticeAllowance(userId, effectivePlan, headers);

    const topic = await this.topicService.getTopicBySlug(topicSlug, headers);
    if (!topic) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Topic not found');
    }

    if (topic.isPremium && effectivePlan === 'free') {
      throw new CSError(HTTP_STATUS_CODES.FORBIDDEN, CODES.PremiumRequired, 'Upgrade required to access this topic');
    }

    const questionData = getPracticeQuestion(topic.slug);
    const question = questionData?.question || topic.description;
    const timeLimit = questionData?.timeLimit || (topic.part === 2 ? 180 : 120);
    const tips = questionData?.tips || this.getDefaultTips(topic.part);

    // Increment usage at session start (same behavior as legacy service).
    await this.usageService.incrementPractice(userId);

    // Resolve topic id for FK.
    const { data: topicRow } = await supabase.from('topics').select('id').eq('slug', topic.slug).maybeSingle();

    const { data: inserted, error } = await supabase
      .from('practice_sessions')
      .insert({
        user_id: userId,
        topic_id: (topicRow as any)?.id || null,
        topic_title: topic.title,
        question,
        part: topic.part,
        category: topic.category,
        difficulty: topic.difficulty,
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .select(
        'id, user_id, topic_id, topic_title, question, source, question_id, audio_recording_id, part, category, difficulty, status, user_response, time_spent, feedback, transcription, audio_path, started_at, completed_at, created_at, updated_at'
      )
      .single();

    if (error || !inserted) {
      this.log.error(`${logMessage} :: Failed to start practice session`, { error: error?.message || error });
      throw new CSError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, CODES.GenericErrorMessage, 'Failed to start session');
    }

    this.log.info(`${logMessage} :: Started session ${inserted.id}`);

    return {
      sessionId: inserted.id,
      topic,
      question,
      timeLimit,
      tips
    };
  }

  public async completeSession(
    userId: string,
    sessionId: string,
    response: string | undefined,
    timeSpent: number | undefined,
    headers: IRequestHeaders
  ) {
    const logMessage = constructLogMessage(__filename, 'completeSession', headers);
    const supabase = getSupabaseAdmin();

    const { data: session, error } = await supabase
      .from('practice_sessions')
      .select(
        'id, user_id, topic_id, topic_title, question, source, question_id, audio_recording_id, part, category, difficulty, status, user_response, time_spent, feedback, transcription, audio_path, started_at, completed_at, created_at, updated_at'
      )
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !session) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Practice session not found');
    }

    const row = session as PracticeSessionRow;
    if (row.status === 'completed') {
      return this.mapSession(row);
    }

    const { data: pref } = await supabase.from('preferences').select('target_band').eq('user_id', userId).maybeSingle();
    const targetBand = (pref as any)?.target_band as string | undefined;

    const feedback = await this.feedbackService.generatePracticeFeedback(row.question, response || '', targetBand, headers);

    const storedFeedback: Record<string, any> = {
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

    const { data: updated, error: updateError } = await supabase
      .from('practice_sessions')
      .update({
        status: 'completed',
        user_response: response,
        time_spent: timeSpent ?? null,
        feedback: storedFeedback,
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select(
        'id, user_id, topic_id, topic_title, question, source, question_id, audio_recording_id, part, category, difficulty, status, user_response, time_spent, feedback, transcription, audio_path, started_at, completed_at, created_at, updated_at'
      )
      .single();

    if (updateError || !updated) {
      this.log.error(`${logMessage} :: Failed to complete session ${sessionId}`, {
        error: updateError?.message || updateError
      });
      throw new CSError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, CODES.GenericErrorMessage, 'Failed to complete session');
    }

    this.log.info(`${logMessage} :: Completed session ${sessionId}`);
    // Best-effort persist to analytics history for progress snapshot + trends.
    try {
      const criteria = this.toAnalyticsCriteriaFromStoredFeedback(storedFeedback);
      await this.analyticsService.saveTestResult({
        userId,
        sessionId,
        testType: TestType.PRACTICE,
        topic: (updated as any)?.topic_title || row.topic_title,
        testPart: `part${row.part}`,
        durationSeconds: Math.max(0, Number((updated as any)?.time_spent ?? timeSpent ?? 0)),
        completedAt: new Date(),
        overallBand: Number(storedFeedback.overallBand || 0),
        criteria,
        corrections: [],
        suggestions: Array.isArray(storedFeedback.improvements) ? storedFeedback.improvements : [],
        metadata: {
          source: 'practice_session'
        }
      });
    } catch (analyticsError: any) {
      this.log.warn(`${logMessage} :: Failed to persist analytics for practice session`, {
        sessionId,
        error: analyticsError?.message || analyticsError
      });
    }

    return this.mapSession(updated as PracticeSessionRow);
  }

  public async listSessions(
    userId: string,
    limit: number,
    offset: number,
    topicSlug: string | undefined,
    headers: IRequestHeaders
  ) {
    const logMessage = constructLogMessage(__filename, 'listSessions', headers);
    const supabase = getSupabaseAdmin();

    let topicId: string | undefined;
    if (topicSlug) {
      const { data: topic } = await supabase.from('topics').select('id').eq('slug', topicSlug).maybeSingle();
      topicId = (topic as any)?.id as string | undefined;
    }

    let query = supabase
      .from('practice_sessions')
      .select(
        'id, user_id, topic_id, topic_title, question, source, question_id, audio_recording_id, part, category, difficulty, status, user_response, time_spent, feedback, transcription, audio_path, started_at, completed_at, created_at, updated_at'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(Math.max(0, offset), Math.max(0, offset) + Math.max(1, limit) - 1);

    if (topicId) {
      query = query.eq('topic_id', topicId);
    }

    const { data, error } = await query;
    if (error) {
      this.log.error(`${logMessage} :: Failed to list sessions`, { error: error.message });
      throw new CSError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, CODES.GenericErrorMessage, 'Failed to list sessions');
    }

    const rows = (data || []) as PracticeSessionRow[];
    const mapped = [];
    for (const row of rows) {
      mapped.push(await this.mapSession(row));
    }
    return mapped;
  }

  /**
   * Persist a completed voice practice session (mobile voice UX).
   * - Uses client-provided sessionId (UUID) for idempotency and easy history linking.
   * - Links to an existing audio_recordings row created during /speech/transcribe.
   */
  public async completeVoiceSession(params: {
    userId: string;
    plan: SubscriptionPlan;
    payload: VoiceCompletePayload;
    headers: IRequestHeaders;
  }) {
    const logMessage = constructLogMessage(__filename, 'completeVoiceSession', params.headers);
    const supabase = getSupabaseAdmin();

    const payload = params.payload;

    if (!payload || typeof payload !== 'object') {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Missing request body');
    }

    const sessionId = String(payload.sessionId || '').trim();
    if (!sessionId || !isUuid(sessionId)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'sessionId (UUID) is required');
    }

    const audioRecordingId = String(payload.audioRecordingId || '').trim();
    if (!audioRecordingId || !isUuid(audioRecordingId)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'audioRecordingId (UUID) is required');
    }

    const topicTitle = String(payload.topicTitle || '').trim();
    const question = String(payload.question || '').trim();
    const transcript = String(payload.transcript || '').trim();
    const part = Number(payload.part);

    if (!topicTitle || !question || !transcript) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'topicTitle, question, and transcript are required');
    }
    if (![1, 2, 3].includes(part)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'part must be 1, 2, or 3');
    }

    const evaluation = payload.evaluation;
    if (!evaluation || typeof evaluation !== 'object') {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'evaluation is required');
    }

    const overallBand = Number((evaluation as any).overallBand);
    if (!Number.isFinite(overallBand) || overallBand <= 0) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'evaluation.overallBand is required');
    }

    const criteria = (evaluation as any).criteria;
    if (!criteria || typeof criteria !== 'object') {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'evaluation.criteria is required');
    }

    const effectivePlan: SubscriptionPlan = env.payments?.disabled ? 'pro' : params.plan;
    await this.usageService.assertPracticeAllowance(params.userId, effectivePlan, params.headers);

    // Ensure recording exists and belongs to the caller.
    const { data: recording } = await supabase
      .from('audio_recordings')
      .select('id, object_path')
      .eq('id', audioRecordingId)
      .eq('user_id', params.userId)
      .maybeSingle();

    if (!recording) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Audio recording not found');
    }

    // Idempotency guard: only increment usage once.
    const { data: existingSession } = await supabase
      .from('practice_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', params.userId)
      .maybeSingle();

    const wasExisting = Boolean(existingSession?.id);

    const bandBreakdown = {
      pronunciation: Number(criteria?.pronunciation?.band || 0),
      fluency: Number(criteria?.fluencyCoherence?.band || 0),
      lexicalResource: Number(criteria?.lexicalResource?.band || 0),
      grammaticalRange: Number(criteria?.grammaticalRange?.band || 0)
    };

    const strengths = [
      ...(Array.isArray(criteria?.fluencyCoherence?.strengths) ? criteria.fluencyCoherence.strengths : []),
      ...(Array.isArray(criteria?.lexicalResource?.strengths) ? criteria.lexicalResource.strengths : []),
      ...(Array.isArray(criteria?.grammaticalRange?.strengths) ? criteria.grammaticalRange.strengths : []),
      ...(Array.isArray(criteria?.pronunciation?.strengths) ? criteria.pronunciation.strengths : [])
    ]
      .filter((s: any) => typeof s === 'string' && s.trim().length > 0)
      .map((s: string) => s.trim())
      .slice(0, 10);

    const improvements = [
      ...(Array.isArray(criteria?.fluencyCoherence?.improvements) ? criteria.fluencyCoherence.improvements : []),
      ...(Array.isArray(criteria?.lexicalResource?.improvements) ? criteria.lexicalResource.improvements : []),
      ...(Array.isArray(criteria?.grammaticalRange?.improvements) ? criteria.grammaticalRange.improvements : []),
      ...(Array.isArray(criteria?.pronunciation?.improvements) ? criteria.pronunciation.improvements : []),
      ...(Array.isArray((evaluation as any).suggestions) ? (evaluation as any).suggestions : [])
    ]
      .filter((s: any) => typeof s === 'string' && s.trim().length > 0)
      .map((s: string) => s.trim())
      .slice(0, 12);

    const storedFeedback: Record<string, any> = {
      overallBand,
      bandBreakdown,
      summary: String((evaluation as any).spokenSummary || '').trim(),
      strengths,
      improvements,
      generatedAt: new Date().toISOString(),
      voiceDetailed: evaluation
    };

    const durationSeconds = Math.max(0, Math.round(Number(payload.durationSeconds || 0)));
    const now = Date.now();

    const upsertPayload: Record<string, any> = {
      id: sessionId,
      user_id: params.userId,
      topic_id: null,
      topic_title: topicTitle,
      question,
      source: 'voice',
      question_id: payload.questionId && isUuid(payload.questionId) ? payload.questionId : null,
      audio_recording_id: audioRecordingId,
      part,
      category: `part${part}`,
      difficulty: payload.difficulty || null,
      status: 'completed',
      user_response: transcript,
      time_spent: durationSeconds,
      audio_path: (recording as any).object_path || null,
      transcription: {
        text: transcript,
        duration: durationSeconds
      },
      feedback: storedFeedback,
      started_at: new Date(now - durationSeconds * 1000).toISOString(),
      completed_at: new Date(now).toISOString()
    };

    const { data: saved, error } = await supabase
      .from('practice_sessions')
      .upsert(upsertPayload, { onConflict: 'id' })
      .select(
        'id, user_id, topic_id, topic_title, question, source, question_id, audio_recording_id, part, category, difficulty, status, user_response, time_spent, feedback, transcription, audio_path, started_at, completed_at, created_at, updated_at'
      )
      .single();

    if (error || !saved) {
      this.log.error(`${logMessage} :: Failed to persist voice session`, { error: error?.message || error });
      throw new CSError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, CODES.GenericErrorMessage, 'Failed to save voice session');
    }

    // Backfill recording metadata with score context (best-effort).
    try {
      await supabase
        .from('audio_recordings')
        .update({
          topic: topicTitle,
          test_part: `part${part}`,
          overall_band: overallBand,
          scores: {
            pronunciation: bandBreakdown.pronunciation,
            fluencyCoherence: bandBreakdown.fluency,
            lexicalResource: bandBreakdown.lexicalResource,
            grammaticalRange: bandBreakdown.grammaticalRange
          }
        })
        .eq('id', audioRecordingId)
        .eq('user_id', params.userId);
    } catch (updateError) {
      // ignore
    }

    // Persist analytics history once per voice session (best-effort).
    try {
      const { data: existingHistory } = await supabase
        .from('test_history')
        .select('id')
        .eq('user_id', params.userId)
        .eq('session_id', sessionId)
        .eq('test_type', 'practice')
        .limit(1);

      const alreadySaved = Array.isArray(existingHistory) && existingHistory.length > 0;
      if (!alreadySaved) {
        await this.analyticsService.saveTestResult({
          userId: params.userId,
          sessionId,
          testType: TestType.PRACTICE,
          topic: topicTitle,
          testPart: `part${part}`,
          durationSeconds,
          completedAt: new Date(),
          overallBand,
          criteria,
          corrections: Array.isArray((evaluation as any).corrections) ? (evaluation as any).corrections : [],
          suggestions: Array.isArray((evaluation as any).suggestions) ? (evaluation as any).suggestions : [],
          audioRecordingId,
          metadata: {
            source: 'voice_practice'
          }
        });
      }
    } catch (analyticsError: any) {
      this.log.warn(`${logMessage} :: Failed to persist analytics for voice session`, {
        sessionId,
        error: analyticsError?.message || analyticsError
      });
    }

    if (!wasExisting) {
      await this.usageService.incrementPractice(params.userId);
    }

    return this.mapSession(saved as PracticeSessionRow);
  }
}
