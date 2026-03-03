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
  pro: 14000,
  team: 22000
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
      deepFeedback?: boolean;
    },
    options: { userId?: string; plan?: SubscriptionPlan }
  ) {
    const criterionLabel = input.taskType === 'task1' ? 'Task Achievement' : 'Task Response';
    const deepFeedback = input.deepFeedback !== false;

    if (!deepFeedback) {
      return this.runStructuredTask({
        userId: options.userId,
        module: 'writing',
        operation: 'evaluate-writing',
        plan: options.plan,
        systemPrompt:
          `You are an IELTS writing examiner. Return strict JSON only.
Required root keys: overallBand, breakdown, feedback.
breakdown must include: taskResponse, coherenceCohesion, lexicalResource, grammaticalRangeAccuracy.
feedback must include: summary, inlineSuggestions[], strengths[], improvements[].
Use ${criterionLabel} terminology in feedback where relevant.
Keep JSON valid with no markdown.`,
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
              summary: `Estimated band ${base.toFixed(1)}. Improve ${criterionLabel.toLowerCase()}, cohesion, and language control for a higher score.`,
              inlineSuggestions: [
                'State your position clearly in the introduction.',
                'Support each body paragraph with a specific example.',
                'Proofread sentence accuracy before submitting.'
              ],
              strengths: ['Maintains overall task relevance.', 'Presents a generally understandable argument.'],
              improvements: [
                `${criterionLabel} needs fuller development with precise support.`,
                'Use clearer transitions between major points.',
                'Reduce grammar slips in complex sentences.'
              ]
            },
            model: 'fallback-local'
          };
        }
      });
    }

    return this.runStructuredTask({
      userId: options.userId,
      module: 'writing',
      operation: 'evaluate-writing',
      plan: options.plan,
      systemPrompt:
        `You are a senior IELTS writing examiner and tutor. Return strict JSON only.
Required root keys: overallBand, breakdown, feedback.
feedback must include: summary, inlineSuggestions[], strengths[], improvements[], overall{}, criteria{}.
criteria keys must be exactly: taskAchievementOrResponse, coherenceCohesion, lexicalResource, grammaticalRangeAccuracy.
Each criterion must include: band, descriptorSummary, strengths[], limitations[], evidence[], whyNotHigher[], howToReach8[], howToReach9[], targetedDrills[], commonExaminerPenaltyTriggers[], bandUpgradeExamples{nextBandSnippet, band9Snippet, differenceNotes[]}.
Each evidence item must include: issue, quotedText, whyItCostsBand, revision, whyRevisionIsBetter, practiceInstruction.
overall must include: band, label, examinerSummary, whyThisBand[], bandGapTo8[], bandGapTo9[], priorityOrder[], nextSteps24h[], nextSteps7d[], nextSteps14d[].
Constraints:
- Use sentence-anchored evidence from the essay in quotedText.
- Be highly specific and actionable, no generic filler.
- Explain what blocks band 8 and band 9 explicitly.
- Use ${criterionLabel} terminology for the first criterion.
- Keep JSON valid with no markdown.`,
      userPrompt: JSON.stringify(input),
      fallback: () => {
        const wordCount = input.responseText.trim().split(/\s+/).filter(Boolean).length;
        const base = Math.min(8, Math.max(4.5, 4.5 + wordCount / 120));
        const taskScore = Number((base - 0.1).toFixed(1));
        const coherenceScore = Number((base + 0.1).toFixed(1));
        const lexicalScore = Number(base.toFixed(1));
        const grammarScore = Number((base - 0.2).toFixed(1));
        const normalizedBand = Number(base.toFixed(1));
        return {
          overallBand: normalizedBand,
          breakdown: {
            taskResponse: taskScore,
            coherenceCohesion: coherenceScore,
            lexicalResource: lexicalScore,
            grammaticalRangeAccuracy: grammarScore
          },
          feedback: {
            summary: 'Solid response with room to improve structure and precision.',
            inlineSuggestions: [
              'Strengthen your introduction with a direct position statement.',
              'Use one main claim per paragraph and support it with a specific example.',
              'Audit sentence accuracy before submission to remove preventable grammar penalties.'
            ],
            strengths: ['Maintains task relevance across the response.', 'Shows a clear attempt to develop key ideas.'],
            improvements: [
              'Increase precision of evidence and examples.',
              'Improve sentence control to reduce avoidable errors.'
            ],
            overall: {
              band: normalizedBand,
              label: `Band ${normalizedBand.toFixed(1)}`,
              examinerSummary:
                `Your essay currently performs around Band ${normalizedBand.toFixed(1)} with consistent relevance but uneven depth and control.`,
              whyThisBand: [
                'Main ideas are generally on-topic and understandable.',
                'Organisation is serviceable, but transitions and paragraph logic are not always efficient.',
                'Language range is visible but not consistently precise.'
              ],
              bandGapTo8: [
                'Develop each body paragraph with clearer logical progression and concrete support.',
                'Increase lexical precision and reduce vague phrasing.',
                'Eliminate repeated grammar slips in complex sentences.'
              ],
              bandGapTo9: [
                'Sustain precise argumentation with sophisticated cohesion throughout.',
                'Demonstrate near-error-free control in complex structures.',
                'Use nuanced vocabulary naturally and consistently.'
              ],
              priorityOrder: [
                `Fix ${criterionLabel.toLowerCase()} clarity first.`,
                'Improve coherence with deliberate paragraph sequencing.',
                'Tighten grammar accuracy in longer sentences.'
              ],
              nextSteps24h: [
                'Rewrite your introduction in two versions and choose the clearer thesis.',
                'Add one specific example sentence to each body paragraph.'
              ],
              nextSteps7d: [
                'Complete 3 timed rewrites focusing on paragraph coherence.',
                'Track your top 5 recurring grammar errors and correct them deliberately.'
              ],
              nextSteps14d: [
                'Submit two full essays with post-draft error audits.',
                'Compare your drafts against a band-8 checklist before finalizing.'
              ]
            },
            criteria: {
              taskAchievementOrResponse: {
                band: taskScore,
                descriptorSummary:
                  `${criterionLabel} is generally adequate, but stronger position clarity and fuller support are needed for higher bands.`,
                strengths: [
                  'Addresses the main prompt and stays largely relevant.',
                  'Attempts to explain a clear stance.'
                ],
                limitations: [
                  'Some claims need fuller explanation or evidence.',
                  'Parts of the response rely on broad statements.'
                ],
                evidence: [
                  {
                    issue: 'Main argument is not fully justified.',
                    quotedText: 'Some people think this method is better for everyone.',
                    whyItCostsBand: 'The claim is broad and lacks precise support, limiting task fulfillment.',
                    revision: 'For adult learners balancing work and study, this method can be more practical because it allows flexible scheduling.',
                    whyRevisionIsBetter: 'The revision narrows scope and adds a reasoned justification.',
                    practiceInstruction: 'After each claim, add one “because + specific context” sentence.'
                  }
                ],
                whyNotHigher: [
                  'Band 8+ requires consistently well-developed ideas with specific support.',
                  'The argument needs sharper scope control and explicit qualification.'
                ],
                howToReach8: [
                  'Use a clear thesis sentence in the introduction and mirror it in topic sentences.',
                  'Support each claim with one concrete example or scenario.'
                ],
                howToReach9: [
                  'Anticipate and rebut counterpoints with concise precision.',
                  'Maintain fully relevant, deeply reasoned support in every paragraph.'
                ],
                targetedDrills: [
                  '3x thesis rewriting drill (clarity + scope + stance).',
                  'Claim-evidence-explanation drill for each body paragraph.'
                ],
                commonExaminerPenaltyTriggers: [
                  'Overgeneralized claims.',
                  'Insufficient development of key points.'
                ],
                bandUpgradeExamples: {
                  nextBandSnippet:
                    'While online learning widens access, its effectiveness depends on learner autonomy and structured feedback, which traditional classrooms often provide more consistently.',
                  band9Snippet:
                    'Although digital platforms democratize access, their pedagogic value hinges on metacognitive discipline and calibrated feedback loops; absent these, modality convenience rarely translates into superior outcomes.',
                  differenceNotes: [
                    'Band 8 adds nuanced condition-setting and clearer logic.',
                    'Band 9 adds precision, sophistication, and zero ambiguity.'
                  ]
                }
              },
              coherenceCohesion: {
                band: coherenceScore,
                descriptorSummary:
                  'Organisation is generally clear, but transitions and paragraph progression can be tighter.',
                strengths: ['Paragraph structure is visible and mostly logical.', 'Ideas usually connect to the paragraph topic.'],
                limitations: [
                  'Some links between ideas feel abrupt.',
                  'Topic sentences do not always forecast paragraph content clearly.'
                ],
                evidence: [
                  {
                    issue: 'Transition does not clearly show contrast.',
                    quotedText: 'Also, this method has disadvantages.',
                    whyItCostsBand: 'Weak connector choice reduces logical precision.',
                    revision: 'However, this method also introduces practical disadvantages.',
                    whyRevisionIsBetter: 'The transition now signals contrast explicitly.',
                    practiceInstruction: 'Choose connectors based on logic: contrast, cause, concession, or addition.'
                  }
                ],
                whyNotHigher: [
                  'Higher bands require seamless progression and controlled reference.',
                  'Some cohesion devices are repetitive or too generic.'
                ],
                howToReach8: [
                  'Use varied, logic-specific transitions.',
                  'Audit each paragraph for a clear topic sentence and concluding link.'
                ],
                howToReach9: [
                  'Create effortless flow through precise referencing and subtle connector control.',
                  'Avoid mechanical sequencing and maintain natural progression.'
                ],
                targetedDrills: [
                  'Connector replacement drill with function labels.',
                  'Paragraph map drill: topic sentence -> evidence -> link-back.'
                ],
                commonExaminerPenaltyTriggers: [
                  'Mechanical linking words.',
                  'Paragraphs that mix multiple unrelated points.'
                ],
                bandUpgradeExamples: {
                  nextBandSnippet:
                    'However, the same flexibility that benefits motivated learners can reduce consistency for students who require external structure.',
                  band9Snippet:
                    'Yet this flexibility is double-edged: while self-directed learners benefit, externally regulated learners often lose the cadence required for cumulative skill acquisition.',
                  differenceNotes: [
                    'Band 8 improves contrast precision.',
                    'Band 9 adds compressed, high-control cohesion.'
                  ]
                }
              },
              lexicalResource: {
                band: lexicalScore,
                descriptorSummary: 'Vocabulary shows range, but precision and collocation control are uneven.',
                strengths: ['Attempts less common vocabulary.', 'Topic vocabulary is generally relevant.'],
                limitations: ['Some word choices are vague.', 'Collocations can sound unnatural in places.'],
                evidence: [
                  {
                    issue: 'Vague lexical choice weakens precision.',
                    quotedText: 'This thing has good effects.',
                    whyItCostsBand: 'Generic wording limits lexical resource score.',
                    revision: 'This policy can yield measurable educational gains.',
                    whyRevisionIsBetter: 'More precise academic lexis improves tone and clarity.',
                    practiceInstruction: 'Replace one vague noun and one vague adjective per paragraph.'
                  }
                ],
                whyNotHigher: [
                  'Band 8/9 requires consistently precise word choice and natural collocations.',
                  'Occasional awkward combinations lower lexical control.'
                ],
                howToReach8: [
                  'Use topic-specific collocations accurately.',
                  'Prefer precise verbs over generic phrases.'
                ],
                howToReach9: [
                  'Sustain nuanced and idiomatic precision without forced complexity.',
                  'Demonstrate flexible paraphrasing with complete naturalness.'
                ],
                targetedDrills: [
                  'Collocation bank drill for your module topic.',
                  'Paraphrase drill: rewrite each claim twice with higher precision.'
                ],
                commonExaminerPenaltyTriggers: ['Repetition of high-frequency vocabulary.', 'Awkward or non-native collocations.'],
                bandUpgradeExamples: {
                  nextBandSnippet:
                    'Public investment in digital platforms can improve access, particularly in underserved areas.',
                  band9Snippet:
                    'Targeted public investment in digital platforms can widen equitable access, especially across chronically underserved regions.',
                  differenceNotes: [
                    'Band 8 improves specificity.',
                    'Band 9 increases nuance and natural collocation quality.'
                  ]
                }
              },
              grammaticalRangeAccuracy: {
                band: grammarScore,
                descriptorSummary:
                  'Sentence variety is present, but consistency of grammar control needs improvement in longer structures.',
                strengths: ['Uses a mix of sentence lengths.', 'Core meaning usually remains clear despite errors.'],
                limitations: [
                  'Errors increase in complex sentences.',
                  'Article and verb-form consistency can break under time pressure.'
                ],
                evidence: [
                  {
                    issue: 'Article and agreement error in a key claim.',
                    quotedText: 'Government should make stronger regulations for this problems.',
                    whyItCostsBand: 'Frequent basic slips reduce grammatical accuracy.',
                    revision: 'The government should introduce stronger regulations for these problems.',
                    whyRevisionIsBetter: 'Corrects article usage, noun form, and agreement while preserving meaning.',
                    practiceInstruction: 'Run a final pass checking articles, plurals, and subject-verb agreement.'
                  }
                ],
                whyNotHigher: [
                  'Band 8+ needs high control of complex grammar with only rare slips.',
                  'Current error density in long clauses limits score ceiling.'
                ],
                howToReach8: [
                  'Use fewer but cleaner complex sentences.',
                  'Track and eliminate recurring grammar errors by category.'
                ],
                howToReach9: [
                  'Demonstrate near-error-free control across a wide structure range.',
                  'Maintain grammatical precision even in nuanced argumentation.'
                ],
                targetedDrills: [
                  'Complex sentence accuracy drill (10 sentences/day).',
                  'Error log remediation drill with weekly retest.'
                ],
                commonExaminerPenaltyTriggers: [
                  'Subject-verb agreement drift.',
                  'Inconsistent tense control in argument paragraphs.'
                ],
                bandUpgradeExamples: {
                  nextBandSnippet:
                    'Although digital learning can be effective, it is most successful when learners receive consistent guidance.',
                  band9Snippet:
                    'While digital learning can be highly effective, its success is maximized when learners receive consistent, diagnostically informed guidance.',
                  differenceNotes: ['Band 8 emphasizes clean complexity.', 'Band 9 combines complexity with full control.']
                }
              }
            }
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
