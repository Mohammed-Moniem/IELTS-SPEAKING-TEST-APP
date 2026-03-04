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

export type WritingTaskGenerationResult = {
  title: string;
  prompt: string;
  instructions: string[];
  suggestedTimeMinutes: number;
  minimumWords: number;
  tags: string[];
  taskType: 'task1' | 'task2';
};

type ReadingQuestionType =
  | 'multiple_choice_single'
  | 'multiple_choice_multiple'
  | 'true_false_not_given'
  | 'yes_no_not_given'
  | 'matching_headings'
  | 'matching_information'
  | 'matching_features'
  | 'matching_sentence_endings'
  | 'sentence_completion'
  | 'summary_completion'
  | 'note_table_flow_completion'
  | 'diagram_label_completion'
  | 'short_answer';

export type ReadingGeneratedQuestion = {
  questionId: string;
  sectionId: 'p1' | 'p2' | 'p3';
  type: ReadingQuestionType;
  prompt: string;
  explanation: string;
  options?: string[];
  answerSpec: {
    kind: 'single' | 'multi' | 'ordered' | 'map';
    value: string | string[] | Record<string, string>;
    caseSensitive?: boolean;
    maxWords?: number;
  };
};

export type ReadingTaskGenerationResult = {
  title: string;
  schemaVersion: 'v2';
  sectionCount: number;
  sections: Array<{
    sectionId: 'p1' | 'p2' | 'p3';
    title: string;
    passageText: string;
    suggestedMinutes: number;
    questions: ReadingGeneratedQuestion[];
  }>;
  passageTitle: string;
  passageText: string;
  suggestedTimeMinutes: number;
  questions: Array<{
    questionId: string;
    type: ReadingQuestionType;
    prompt: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }>;
  tags: string[];
};

export type ListeningTaskGenerationResult = {
  title: string;
  sectionTitle: string;
  transcript: string;
  audioUrl: string;
  suggestedTimeMinutes: number;
  questions: Array<{
    questionId: string;
    type: string;
    prompt: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
  }>;
  tags: string[];
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

  public async generateReadingDeepFeedback(
    input: {
      track: 'academic' | 'general';
      score: number;
      totalQuestions: number;
      sectionStats: Array<{ sectionId: 'p1' | 'p2' | 'p3'; score: number; total: number }>;
      questionTypeStats: Array<{ type: string; correct: number; total: number }>;
      mistakes: Array<{
        sectionId: 'p1' | 'p2' | 'p3';
        questionId: string;
        type: string;
        userAnswer: string | string[] | Record<string, string>;
        expectedAnswer: string | string[] | Record<string, string>;
        feedbackHint?: string;
      }>;
      testTitle?: string;
    },
    options: { userId?: string; plan?: SubscriptionPlan }
  ) {
    return this.runStructuredTask({
      userId: options.userId,
      module: 'reading',
      operation: 'evaluate-reading-deep',
      plan: options.plan,
      systemPrompt:
        `You are an IELTS Reading tutor. Return strict JSON with keys:
overallSummary, sectionCoaching[], questionTypeCoaching[], top5Fixes[], next24hPlan[], next7dPlan[].
sectionCoaching[] item keys: sectionId, focusAreas[], traps[], drills[].
questionTypeCoaching[] item keys: type, whyWrong[], fixes[], drills[].
Use concrete, exam-practical language. Keep JSON valid with no markdown.`,
      userPrompt: JSON.stringify(input),
      fallback: () => {
        const accuracy = input.totalQuestions > 0 ? (input.score / input.totalQuestions) * 100 : 0;
        return {
          overallSummary: `Estimated reading accuracy ${accuracy.toFixed(0)}%. Raise consistency by targeting your weakest question families first, then tightening passage evidence tracking.`,
          sectionCoaching: input.sectionStats.map(section => ({
            sectionId: section.sectionId,
            focusAreas: [
              `Section accuracy: ${section.score}/${section.total}`,
              'Identify exact evidence lines before selecting an answer.'
            ],
            traps: [
              'Answering from memory instead of passage text.',
              'Rushing without checking qualifier words (only, mainly, except).'
            ],
            drills: [
              '2 timed passages with evidence-underlining before answer commit.',
              'Post-test error log by question type and trap reason.'
            ]
          })),
          questionTypeCoaching: input.questionTypeStats.map(stat => ({
            type: stat.type,
            whyWrong:
              stat.correct < stat.total
                ? [
                    'Misread keyword constraints in prompt/options.',
                    'Insufficient elimination strategy for close distractors.'
                  ]
                : ['Performance is stable; maintain process discipline.'],
            fixes: [
              'Underline anchor words in both question and passage.',
              'Use elimination before final answer selection.'
            ],
            drills: ['10-question focused set on this type with immediate review.']
          })),
          top5Fixes: [
            'Match answers to exact passage evidence, not assumptions.',
            'Prioritize accuracy in headings and matching groups.',
            'Use a second-pass check for True/False/Not Given logic.',
            'Cap time spent per hard question and return later.',
            'Track recurring errors by type after every attempt.'
          ],
          next24hPlan: [
            'Complete one timed mini-test and annotate evidence lines per answer.',
            'Review all incorrect answers and classify by trap pattern.'
          ],
          next7dPlan: [
            'Do 5 mixed reading sets and monitor type-level accuracy.',
            'Repeat weakest two question families until >=80% accuracy.'
          ]
        };
      }
    });
  }

  public async generateModuleTask(
    input: { module: 'writing'; track: 'academic' | 'general'; hints?: string[] },
    options: { userId?: string; plan?: SubscriptionPlan }
  ): Promise<WritingTaskGenerationResult>;
  public async generateModuleTask(
    input: { module: 'reading'; track: 'academic' | 'general'; hints?: string[] },
    options: { userId?: string; plan?: SubscriptionPlan }
  ): Promise<ReadingTaskGenerationResult>;
  public async generateModuleTask(
    input: { module: 'listening'; track: 'academic' | 'general'; hints?: string[] },
    options: { userId?: string; plan?: SubscriptionPlan }
  ): Promise<ListeningTaskGenerationResult>;
  public async generateModuleTask(
    input: {
      module: 'writing' | 'reading' | 'listening';
      track: 'academic' | 'general';
      hints?: string[];
    },
    options: { userId?: string; plan?: SubscriptionPlan }
  ): Promise<WritingTaskGenerationResult | ReadingTaskGenerationResult | ListeningTaskGenerationResult> {
    return this.runStructuredTask({
      userId: options.userId,
      module: input.module,
      operation: `generate-${input.module}-task`,
      plan: options.plan,
      systemPrompt: 'You generate IELTS tasks in strict JSON only. Keep content realistic and exam-style.',
      userPrompt: JSON.stringify(input),
      fallback: () => {
        if (input.module === 'writing') {
          const requestedTaskType = input.hints?.includes('task1') ? 'task1' : 'task2';
          const taskPools: Record<
            'academic_task1' | 'general_task1' | 'academic_task2' | 'general_task2',
            Array<{
              title: string;
              prompt: string;
              instructions: string[];
              suggestedTimeMinutes: number;
              minimumWords: number;
              tags: string[];
              taskType: 'task1' | 'task2';
            }>
          > = {
            academic_task1: [
              {
                title: 'Academic Task 1 Bar Chart Analysis',
                prompt:
                  'The bar chart compares the percentage of households using three renewable energy sources (solar, wind, and hydro) in six regions between 2012 and 2022. Summarize the information by selecting and reporting the main features, and make comparisons where relevant.',
                instructions: [
                  'Write at least 150 words.',
                  'Highlight the most significant changes and comparisons.',
                  'Provide an overview before detailed comparisons.'
                ],
                suggestedTimeMinutes: 20,
                minimumWords: 150,
                taskType: 'task1',
                tags: ['energy', 'bar-chart', 'comparison']
              },
              {
                title: 'Academic Task 1 Line Graph Trends',
                prompt:
                  'The line graph shows average monthly metro ridership in three cities from 2010 to 2024. Summarize the information by selecting and reporting the main features, and make comparisons where relevant.',
                instructions: [
                  'Write at least 150 words.',
                  'Focus on overall trends and notable fluctuations.',
                  'Use accurate comparative language.'
                ],
                suggestedTimeMinutes: 20,
                minimumWords: 150,
                taskType: 'task1',
                tags: ['transport', 'line-graph', 'trends']
              },
              {
                title: 'Academic Task 1 Table Comparison',
                prompt:
                  'The table presents the number of international students enrolled in five university departments in 2015, 2020, and 2025. Summarize the information by selecting and reporting the main features, and make comparisons where relevant.',
                instructions: [
                  'Write at least 150 words.',
                  'Group similar data instead of describing every row separately.',
                  'Include a clear overview of the largest shifts.'
                ],
                suggestedTimeMinutes: 20,
                minimumWords: 150,
                taskType: 'task1',
                tags: ['table', 'education', 'comparison']
              }
            ],
            general_task1: [
              {
                title: 'General Task 1 Semi-Formal Letter',
                prompt:
                  'You recently attended a short course at a local college. Write a letter to the course coordinator. In your letter: explain what you liked about the course, describe one problem you faced, and suggest one improvement for future students.',
                instructions: [
                  'Write at least 150 words.',
                  'Address every bullet point clearly.',
                  'Use an appropriate semi-formal tone throughout.'
                ],
                suggestedTimeMinutes: 20,
                minimumWords: 150,
                taskType: 'task1',
                tags: ['letter', 'semi-formal', 'course']
              },
              {
                title: 'General Task 1 Formal Complaint Letter',
                prompt:
                  'You booked a study room at a public library, but it was unavailable when you arrived. Write a letter to the library manager. In your letter: describe what happened, explain how this affected your preparation, and request a suitable solution.',
                instructions: [
                  'Write at least 150 words.',
                  'Use a formal and polite tone.',
                  'Make your request specific and reasonable.'
                ],
                suggestedTimeMinutes: 20,
                minimumWords: 150,
                taskType: 'task1',
                tags: ['letter', 'formal', 'complaint']
              },
              {
                title: 'General Task 1 Informal Letter',
                prompt:
                  'A friend is planning to move to your city for IELTS preparation. Write a letter to your friend. In your letter: describe the area you recommend, suggest two useful study resources, and explain how to balance study with daily life.',
                instructions: [
                  'Write at least 150 words.',
                  'Use a friendly but clear tone.',
                  'Cover all three bullet points in separate paragraphs.'
                ],
                suggestedTimeMinutes: 20,
                minimumWords: 150,
                taskType: 'task1',
                tags: ['letter', 'informal', 'advice']
              }
            ],
            academic_task2: [
              {
                title: 'Academic Task 2 Opinion Essay',
                prompt:
                  'Some people believe schools should teach only academic subjects, while others think practical life skills should be equally important. Discuss both views and give your own opinion.',
                instructions: ['Write at least 250 words.', 'Support your position with clear examples.'],
                suggestedTimeMinutes: 40,
                minimumWords: 250,
                taskType: 'task2',
                tags: ['education', 'opinion', 'society']
              },
              {
                title: 'Academic Task 2 Discussion Essay',
                prompt:
                  'In many cities, private cars are being restricted in central areas. Some people support this policy, while others oppose it. Discuss both views and give your own opinion.',
                instructions: ['Write at least 250 words.', 'Develop each viewpoint before your conclusion.'],
                suggestedTimeMinutes: 40,
                minimumWords: 250,
                taskType: 'task2',
                tags: ['transport', 'policy', 'discussion']
              },
              {
                title: 'Academic Task 2 Problem-Solution Essay',
                prompt:
                  'Many university students struggle to manage stress during exam seasons. What are the causes of this problem, and what measures can universities take to reduce it?',
                instructions: ['Write at least 250 words.', 'Explain both causes and practical solutions.'],
                suggestedTimeMinutes: 40,
                minimumWords: 250,
                taskType: 'task2',
                tags: ['health', 'education', 'problem-solution']
              }
            ],
            general_task2: [
              {
                title: 'General Task 2 Opinion Essay',
                prompt:
                  'Some people think social media has made communication better, while others believe it has harmed real relationships. Discuss both views and give your own opinion.',
                instructions: ['Write at least 250 words.', 'Use clear reasoning and specific examples.'],
                suggestedTimeMinutes: 40,
                minimumWords: 250,
                taskType: 'task2',
                tags: ['technology', 'relationships', 'opinion']
              },
              {
                title: 'General Task 2 Discussion Essay',
                prompt:
                  'Some people prefer working from home, while others prefer working in an office. Discuss both views and give your own opinion.',
                instructions: ['Write at least 250 words.', 'Compare both perspectives fairly before concluding.'],
                suggestedTimeMinutes: 40,
                minimumWords: 250,
                taskType: 'task2',
                tags: ['work', 'lifestyle', 'discussion']
              },
              {
                title: 'General Task 2 Advantage-Disadvantage Essay',
                prompt:
                  'More people are choosing to study through online platforms instead of attending in-person classes. What are the advantages and disadvantages of this trend?',
                instructions: ['Write at least 250 words.', 'Balance both sides with concrete examples.'],
                suggestedTimeMinutes: 40,
                minimumWords: 250,
                taskType: 'task2',
                tags: ['education', 'technology', 'advantages-disadvantages']
              }
            ]
          };

          const poolKey = `${input.track}_${requestedTaskType}` as
            | 'academic_task1'
            | 'general_task1'
            | 'academic_task2'
            | 'general_task2';
          const pool = taskPools[poolKey];
          const seedValue = input.hints?.find(hint => hint.startsWith('seed-')) || `${Date.now()}-${Math.random()}`;
          const seedHash = createHash('sha1').update(seedValue).digest('hex');
          const pickIndex = parseInt(seedHash.slice(0, 8), 16) % pool.length;
          return pool[pickIndex];
        }

        if (input.module === 'reading') {
          const sectionTypes: ReadingQuestionType[] = [
            'matching_headings',
            'multiple_choice_single',
            'true_false_not_given',
            'summary_completion',
            'short_answer',
            'multiple_choice_multiple',
            'matching_information',
            'yes_no_not_given',
            'sentence_completion',
            'matching_features',
            'matching_sentence_endings',
            'note_table_flow_completion',
            'diagram_label_completion'
          ];
          const makeQuestion = (sectionId: 'p1' | 'p2' | 'p3', index: number): ReadingGeneratedQuestion => {
            const type = sectionTypes[(index - 1) % sectionTypes.length];
            const base = {
              questionId: `${sectionId}_q${index}`,
              sectionId,
              type,
              prompt: `(${sectionId.toUpperCase()}-${index}) Answer based on the passage evidence.`,
              explanation: 'Locate the exact sentence span that supports your answer.'
            };
            if (type === 'multiple_choice_single' || type === 'multiple_choice_multiple') {
              return {
                ...base,
                options: ['A', 'B', 'C', 'D'],
                answerSpec: {
                  kind: type === 'multiple_choice_multiple' ? 'multi' : 'single',
                  value: type === 'multiple_choice_multiple' ? ['A', 'C'] : 'A'
                }
              };
            }
            if (type === 'matching_features' || type === 'matching_information') {
              return {
                ...base,
                options: ['A', 'B', 'C', 'D', 'E'],
                answerSpec: { kind: 'single', value: 'B' }
              };
            }
            if (type === 'matching_sentence_endings') {
              return {
                ...base,
                options: ['i', 'ii', 'iii', 'iv', 'v', 'vi'],
                answerSpec: { kind: 'single', value: 'iii' }
              };
            }
            if (type === 'true_false_not_given' || type === 'yes_no_not_given') {
              return {
                ...base,
                options: type === 'true_false_not_given' ? ['True', 'False', 'Not Given'] : ['Yes', 'No', 'Not Given'],
                answerSpec: { kind: 'single', value: 'Not Given' }
              };
            }
            return {
              ...base,
              answerSpec: { kind: 'single', value: 'sample answer', caseSensitive: false, maxWords: 3 }
            };
          };

          const buildSection = (sectionId: 'p1' | 'p2' | 'p3', start: number, count: number) => ({
            sectionId,
            title: `Passage ${sectionId === 'p1' ? 1 : sectionId === 'p2' ? 2 : 3}`,
            passageText:
              sectionId === 'p1'
                ? 'Passage 1 discusses public policy implementation and evidence-based decision making in urban infrastructure.'
                : sectionId === 'p2'
                  ? 'Passage 2 examines contrasting expert viewpoints and case studies across education and workforce transitions.'
                  : 'Passage 3 provides advanced analytical arguments with competing interpretations and nuanced claims.',
            suggestedMinutes: 20,
            questions: Array.from({ length: count }, (_, offset) => makeQuestion(sectionId, start + offset))
          });

          const sections: ReadingTaskGenerationResult['sections'] = [
            buildSection('p1', 1, 13),
            buildSection('p2', 14, 13),
            buildSection('p3', 27, 14)
          ];

          const questions = sections.flatMap(section =>
            section.questions.map(question => ({
              questionId: question.questionId,
              type: question.type,
              prompt: question.prompt,
              options: Array.isArray(question.options) ? question.options : [],
              correctAnswer: typeof question.answerSpec?.value === 'string' ? question.answerSpec.value : '',
              explanation: question.explanation || ''
            }))
          );

          return {
            title: `${input.track.toUpperCase()} Reading Practice`,
            schemaVersion: 'v2',
            sectionCount: 3,
            sections,
            passageTitle: sections[0].title,
            passageText: sections[0].passageText,
            suggestedTimeMinutes: 60,
            questions,
            tags: ['urban', 'policy']
          };
        }

        const questions = [
          {
            questionId: 'q1',
            type: 'multiple_choice',
            prompt: 'What is the main idea of the section?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            explanation: 'Option A best matches the central idea.'
          },
          {
            questionId: 'q2',
            type: 'short_answer',
            prompt: 'According to the audio, what is one key challenge?',
            correctAnswer: 'Limited access to resources',
            explanation: 'The section explicitly names resource access as a challenge.'
          }
        ];

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
