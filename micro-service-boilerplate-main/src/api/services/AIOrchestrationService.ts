import { createHash } from 'crypto';
import OpenAI from 'openai';
import { Service } from 'typedi';

import { env } from '@env';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { Logger } from '@lib/logger';
import { AIUsageLogModel, AIUsageModule } from '@models/AIUsageLogModel';
import { SubscriptionPlan } from '@models/UserModel';

import { UsageService } from './UsageService';

type StructuredTaskParams<T> = {
  userId?: string;
  module: AIUsageModule;
  operation: string;
  systemPrompt: string;
  userPrompt: string;
  fallback: () => T;
  plan?: SubscriptionPlan;
};

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const PLAN_TOKEN_CAP: Record<SubscriptionPlan, number> = {
  free: 3000,
  premium: 8000,
  pro: 14000
};

@Service()
export class AIOrchestrationService {
  private readonly log = new Logger(__filename);
  private readonly openai = env.openai.apiKey
    ? new OpenAI({ apiKey: env.openai.apiKey })
    : null;
  private readonly cache = new Map<string, CacheEntry>();

  private readonly CACHE_TTL_MS = 10 * 60 * 1000;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_COOLDOWN_MS = 60 * 1000;

  private failureCount = 0;
  private blockedUntil = 0;

  constructor(private readonly usageService: UsageService) {}

  public async evaluateWriting(
    input: {
      prompt: string;
      responseText: string;
      taskType: 'task1' | 'task2';
      track: 'academic' | 'general';
    },
    options: { userId?: string; plan?: SubscriptionPlan }
  ) {
    return this.runStructuredTask({
      userId: options.userId,
      module: 'writing',
      operation: 'evaluate-writing',
      plan: options.plan,
      systemPrompt:
        'You are an IELTS writing examiner. Return strict JSON only with overallBand, breakdown, feedback summary, inlineSuggestions, strengths, improvements.',
      userPrompt: JSON.stringify(input),
      fallback: () => {
        const wordCount = input.responseText.trim().split(/\s+/).filter(Boolean).length;
        const base = Math.min(8, Math.max(4.5, 4.5 + wordCount / 120));
        return {
          overallBand: Number(base.toFixed(1)),
          breakdown: {
            taskResponse: Number((base - 0.1).toFixed(1)),
            coherenceCohesion: Number((base + 0.1).toFixed(1)),
            lexicalResource: Number(base.toFixed(1)),
            grammaticalRangeAccuracy: Number((base - 0.2).toFixed(1))
          },
          feedback: {
            summary: 'Solid response with room to improve structure and precision.',
            inlineSuggestions: [
              'Use clearer paragraph topic sentences.',
              'Add precise lexical choices for key claims.'
            ],
            strengths: ['Maintains topic relevance', 'Adequate idea development'],
            improvements: ['Improve coherence between paragraphs', 'Increase grammatical accuracy']
          },
          model: 'fallback-local'
        };
      }
    });
  }

  public async evaluateObjectiveModule(
    input: {
      module: 'reading' | 'listening';
      score: number;
      totalQuestions: number;
      track: 'academic' | 'general';
      incorrectTopics: string[];
    },
    options: { userId?: string; plan?: SubscriptionPlan }
  ) {
    return this.runStructuredTask({
      userId: options.userId,
      module: input.module,
      operation: `evaluate-${input.module}`,
      plan: options.plan,
      systemPrompt:
        'You are an IELTS tutor. Return strict JSON only with normalizedBand, feedback summary, strengths, improvements, suggestions.',
      userPrompt: JSON.stringify(input),
      fallback: () => {
        const normalizedBand = this.mapObjectiveScoreToBand(input.score, input.totalQuestions);
        return {
          normalizedBand,
          feedback: {
            summary: `You answered ${input.score} out of ${input.totalQuestions}.`,
            strengths: ['Completed the section', 'Demonstrated exam awareness'],
            improvements:
              input.incorrectTopics.length > 0
                ? [`Focus on ${input.incorrectTopics.join(', ')}`]
                : ['Maintain consistency under time pressure'],
            suggestions: [
              'Review error patterns before the next attempt.',
              'Practice timed sets to improve pacing.'
            ]
          },
          model: 'fallback-local'
        };
      }
    });
  }

  public async generateModuleTask(
    input: {
      module: 'writing' | 'reading' | 'listening';
      track: 'academic' | 'general';
      hints?: string[];
    },
    options: { userId?: string; plan?: SubscriptionPlan }
  ) {
    return this.runStructuredTask({
      userId: options.userId,
      module: input.module,
      operation: `generate-${input.module}-task`,
      plan: options.plan,
      systemPrompt: 'You generate IELTS tasks in strict JSON only. Keep content realistic and exam-style.',
      userPrompt: JSON.stringify(input),
      fallback: () => {
        if (input.module === 'writing') {
          return {
            title: input.track === 'academic' ? 'Task 2 Opinion Essay' : 'Task 2 Problem-Solution Essay',
            prompt:
              'Some people believe online learning is more effective than classroom learning. Discuss both views and give your opinion.',
            instructions: ['Write at least 250 words.', 'Support your arguments with clear examples.'],
            suggestedTimeMinutes: 40,
            minimumWords: 250,
            taskType: 'task2',
            tags: ['education', 'technology']
          };
        }

        const questions = [
          {
            questionId: 'q1',
            type: 'multiple_choice',
            prompt: 'What is the main idea of the passage?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            explanation: 'Option A best matches the central argument.'
          },
          {
            questionId: 'q2',
            type: 'short_answer',
            prompt: 'According to the text, what is one key challenge?',
            correctAnswer: 'Limited access to resources',
            explanation: 'The passage explicitly names resource access as a challenge.'
          }
        ];

        if (input.module === 'reading') {
          return {
            title: `${input.track.toUpperCase()} Reading Practice`,
            passageTitle: 'Urban Planning and Livability',
            passageText:
              'Cities are increasingly balancing growth with sustainability. Policy makers now evaluate transportation, housing, and public space in integrated frameworks.',
            suggestedTimeMinutes: 20,
            questions,
            tags: ['urban', 'policy']
          };
        }

        return {
          title: `${input.track.toUpperCase()} Listening Practice`,
          sectionTitle: 'Campus Orientation Talk',
          transcript:
            'Welcome to the orientation session. Today we will explain facilities, schedules, and support services available to all students.',
          audioUrl: '',
          suggestedTimeMinutes: 20,
          questions,
          tags: ['education', 'orientation']
        };
      }
    });
  }

  private async runStructuredTask<T>(params: StructuredTaskParams<T>): Promise<T> {
    const plan = params.plan || 'free';
    const estimatedInputTokens = this.estimateTokens(params.userPrompt + params.systemPrompt);

    if (estimatedInputTokens > PLAN_TOKEN_CAP[plan]) {
      await this.persistUsageLog({
        userId: params.userId,
        module: params.module,
        operation: params.operation,
        model: env.openai.model || 'blocked-by-guardrail',
        requestHash: this.hashPayload(params.systemPrompt, params.userPrompt),
        inputTokens: estimatedInputTokens,
        outputTokens: 0,
        estimatedCostUsd: 0,
        cacheHit: false,
        status: 'blocked',
        errorMessage: `Token limit exceeded for plan ${plan}`
      });

      throw new CSError(HTTP_STATUS_CODES.FORBIDDEN, CODES.UsageLimitReached, 'AI usage limit reached for your plan');
    }

    const key = this.hashPayload(params.systemPrompt, params.userPrompt);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      await this.persistUsageLog({
        userId: params.userId,
        module: params.module,
        operation: params.operation,
        model: env.openai.model || 'cached',
        requestHash: key,
        inputTokens: estimatedInputTokens,
        outputTokens: 0,
        estimatedCostUsd: 0,
        cacheHit: true,
        status: 'success'
      });
      return cached.value as T;
    }

    if (this.isCircuitOpen()) {
      this.log.warn('AI circuit breaker open, using fallback response', {
        operation: params.operation,
        module: params.module
      });
      return params.fallback();
    }

    if (!this.openai) {
      return params.fallback();
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: env.openai.model || 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: Math.min(PLAN_TOKEN_CAP[plan], 1500),
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: params.systemPrompt
          },
          {
            role: 'user',
            content: params.userPrompt
          }
        ]
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No response content returned from model');
      }

      const parsed = JSON.parse(content) as T;
      this.cache.set(key, {
        value: parsed,
        expiresAt: Date.now() + this.CACHE_TTL_MS
      });

      const usage = completion.usage;
      const inputTokens = usage?.prompt_tokens || estimatedInputTokens;
      const outputTokens = usage?.completion_tokens || this.estimateTokens(content);
      const estimatedCostUsd = this.estimateCostUsd(inputTokens, outputTokens);

      await this.persistUsageLog({
        userId: params.userId,
        module: params.module,
        operation: params.operation,
        model: completion.model,
        requestHash: key,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
        cacheHit: false,
        status: 'success'
      });

      if (params.userId) {
        await this.usageService.incrementAIUsage(params.userId, inputTokens + outputTokens, estimatedCostUsd);
      }

      this.failureCount = 0;
      return parsed;
    } catch (error: any) {
      this.failureCount += 1;
      if (this.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
        this.blockedUntil = Date.now() + this.CIRCUIT_BREAKER_COOLDOWN_MS;
      }

      await this.persistUsageLog({
        userId: params.userId,
        module: params.module,
        operation: params.operation,
        model: env.openai.model || 'unknown',
        requestHash: key,
        inputTokens: estimatedInputTokens,
        outputTokens: 0,
        estimatedCostUsd: 0,
        cacheHit: false,
        status: 'error',
        errorMessage: error?.message || 'Unknown AI orchestration error'
      });

      this.log.error('AI task failed, returning fallback response', {
        operation: params.operation,
        module: params.module,
        error: error?.message
      });

      return params.fallback();
    }
  }

  private mapObjectiveScoreToBand(score: number, totalQuestions: number) {
    if (totalQuestions <= 0) return 0;
    const ratio = score / totalQuestions;
    const mapped = Math.min(9, Math.max(0, 9 * ratio));
    return Number(mapped.toFixed(1));
  }

  private estimateTokens(input: string) {
    return Math.max(1, Math.ceil((input || '').length / 4));
  }

  private estimateCostUsd(inputTokens: number, outputTokens: number) {
    const inputCost = inputTokens * 0.0000004;
    const outputCost = outputTokens * 0.0000012;
    return Number((inputCost + outputCost).toFixed(6));
  }

  private hashPayload(systemPrompt: string, userPrompt: string) {
    return createHash('sha256').update(`${systemPrompt}\n${userPrompt}`).digest('hex');
  }

  private isCircuitOpen() {
    return Date.now() < this.blockedUntil;
  }

  private async persistUsageLog(payload: {
    userId?: string;
    module: AIUsageModule;
    operation: string;
    model: string;
    requestHash: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    cacheHit: boolean;
    status: 'success' | 'error' | 'blocked';
    errorMessage?: string;
  }) {
    const userObjectId = payload.userId ? (payload.userId as any) : undefined;

    await AIUsageLogModel.create({
      userId: userObjectId,
      module: payload.module,
      operation: payload.operation,
      model: payload.model,
      requestHash: payload.requestHash,
      inputTokens: payload.inputTokens,
      outputTokens: payload.outputTokens,
      estimatedCostUsd: payload.estimatedCostUsd,
      cacheHit: payload.cacheHit,
      status: payload.status,
      errorMessage: payload.errorMessage
    });
  }
}
