import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { IPracticeFeedback } from '@models/PracticeSessionModel';
import { TestPreferenceModel } from '@models/TestPreferenceModel';
import { TestSimulationDocument, TestSimulationModel } from '@models/TestSimulationModel';
import { UserModel } from '@models/UserModel';
import { Service } from 'typedi';
import { TestSimulationRuntimeDto, TestSimulationSessionResponseDto } from '@dto/TestSimulationDto';

import { FeedbackService } from './FeedbackService';
import { ExaminerPhraseService } from './ExaminerPhraseService';
import { QuestionGenerationService } from './QuestionGenerationService';
import { SpeakingSessionPackageService } from './SpeakingSessionPackageService';
import { SpeechService } from './SpeechService';
import { UsageService } from './UsageService';

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

interface RuntimeAnswerPayload {
  transcript: string;
  durationSeconds?: number;
}

@Service()
export class TestSimulationService {
  private log = new Logger(__filename);
  private readonly examinerPhraseService = new ExaminerPhraseService();

  constructor(
    private readonly usageService: UsageService,
    private readonly feedbackService: FeedbackService,
    private readonly questionGenerationService: QuestionGenerationService,
    private readonly speechService: SpeechService = new SpeechService(),
    private readonly sessionPackageService: SpeakingSessionPackageService = new SpeakingSessionPackageService()
  ) {}

  public async startSimulation(userId: string, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'startSimulation', headers);

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    await this.usageService.assertTestAllowance(userId, user.subscriptionPlan, headers);

    // Increment usage counter IMMEDIATELY after passing allowance check
    // This prevents race conditions where multiple simulations can be started simultaneously
    await this.usageService.incrementTest(userId);

    const parts = await this.buildSimulationParts(userId, headers);
    const runtime = this.buildInitialRuntime();
    const sessionPackage = await this.sessionPackageService.buildSessionPackage(parts);
    const simulation = (await TestSimulationModel.create({
      user: userId,
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
      runtime,
      sessionPackage,
      startedAt: new Date()
    })) as TestSimulationDocument;

    this.log.info(`${logMessage} :: Started simulation ${simulation._id}`);

    return {
      simulationId: simulation._id,
      parts,
      runtime,
      sessionPackage
    };
  }

  private buildInitialRuntime(): TestSimulationRuntimeDto {
    const introPhrase = this.examinerPhraseService.getPhrase('welcome_intro');

    return {
      state: 'intro-examiner',
      currentPart: 0,
      currentTurnIndex: 0,
      retryCount: 0,
      retryBudgetRemaining: 1,
      introStep: 'welcome',
      seedQuestionIndex: 0,
      followUpCount: 0,
      partFollowUpCount: 0,
      conversationHistory: [],
      turnHistory: [],
      currentSegment: {
        kind: 'cached_phrase',
        phraseId: introPhrase.id,
        text: introPhrase.text
      }
    };
  }

  public async getRuntime(userId: string, simulationId: string) {
    const simulation = await this.getOwnedSimulation(userId, simulationId);
    return this.buildRuntimeResponse(simulation);
  }

  public async advanceRuntime(userId: string, simulationId: string, headers: IRequestHeaders) {
    const simulation = await this.getOwnedSimulation(userId, simulationId);
    const runtime = simulation.runtime || this.buildInitialRuntime();
    simulation.runtime = runtime;

    this.resetRetryBudget(runtime);

    switch (runtime.state) {
      case 'intro-examiner':
        if (runtime.introStep === 'welcome') {
          runtime.state = 'intro-candidate-turn';
          break;
        }

        if (runtime.introStep === 'id_check') {
          const part1Begin = this.examinerPhraseService.getPhrase('part1_begin');
          runtime.introStep = 'part1_begin';
          runtime.state = 'intro-examiner';
          runtime.currentSegment = {
            kind: 'cached_phrase',
            phraseId: part1Begin.id,
            text: part1Begin.text
          };
          break;
        }

        this.moveToSeedQuestion(simulation, 1, 0);
        break;

      case 'part1-examiner':
        runtime.state = 'part1-candidate-turn';
        break;

      case 'part1-transition':
        this.moveToCachedPhrase(simulation, 2, 'part2_intro', 'part2-intro');
        break;

      case 'part2-intro':
        runtime.state = 'part2-prep';
        runtime.currentSegment = {
          kind: 'dynamic_prompt',
          text: this.getPartPromptText(simulation, 2)
        };
        break;

      case 'part2-prep': {
        const beginSpeaking = this.examinerPhraseService.getPhrase('part2_begin_speaking');
        runtime.state = 'part2-examiner-launch';
        runtime.currentSegment = {
          kind: 'cached_phrase',
          phraseId: beginSpeaking.id,
          text: beginSpeaking.text
        };
        break;
      }

      case 'part2-examiner-launch':
        runtime.state = 'part2-candidate-turn';
        runtime.currentSegment = {
          kind: 'dynamic_prompt',
          text: this.getPartPromptText(simulation, 2)
        };
        break;

      case 'part2-transition':
        this.moveToCachedPhrase(simulation, 3, 'part3_intro', 'part3-intro');
        break;

      case 'part3-intro':
        this.moveToSeedQuestion(simulation, 3, 0);
        break;

      case 'part3-examiner':
        runtime.state = 'part3-candidate-turn';
        break;

      case 'paused-retryable':
        if (!runtime.previousState) {
          throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'No retryable step available');
        }
        runtime.state = runtime.previousState;
        runtime.previousState = undefined;
        runtime.lastError = undefined;
        runtime.failedStep = undefined;
        runtime.retryCount = 0;
        break;

      default:
        throw new CSError(
          HTTP_STATUS_CODES.BAD_REQUEST,
          CODES.InvalidBody,
          `Runtime cannot advance from state ${runtime.state}`
        );
    }

    await simulation.save();
    return this.buildRuntimeResponse(simulation);
  }

  public async submitRuntimeAnswer(
    userId: string,
    simulationId: string,
    payload: RuntimeAnswerPayload,
    headers: IRequestHeaders
  ) {
    const simulation = await this.getOwnedSimulation(userId, simulationId);
    const runtime = simulation.runtime || this.buildInitialRuntime();
    simulation.runtime = runtime;

    const transcript = payload.transcript?.trim();
    if (!transcript) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Transcript is required');
    }

    if (runtime.state === 'intro-candidate-turn') {
      this.appendTurnRecord(runtime, 0, runtime.currentSegment.text || '', transcript, payload.durationSeconds);

      const idCheck = this.examinerPhraseService.getPhrase('id_check');
      runtime.state = 'intro-examiner';
      runtime.introStep = 'id_check';
      runtime.retryCount = 0;
      runtime.retryBudgetRemaining = 1;
      runtime.currentSegment = {
        kind: 'cached_phrase',
        phraseId: idCheck.id,
        text: idCheck.text
      };

      await simulation.save();
      return this.buildRuntimeResponse(simulation);
    }

    if (runtime.state === 'part2-candidate-turn') {
      this.appendTurnRecord(runtime, 2, this.getPartPromptText(simulation, 2), transcript, payload.durationSeconds);
      this.moveToCachedPhrase(simulation, 2, 'part2_transition', 'part2-transition');
      await simulation.save();
      return this.buildRuntimeResponse(simulation);
    }

    if (runtime.state !== 'part1-candidate-turn' && runtime.state !== 'part3-candidate-turn') {
      throw new CSError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        CODES.InvalidBody,
        `Runtime cannot accept an answer in state ${runtime.state}`
      );
    }

    const partNumber = runtime.currentPart as 1 | 3;
    const promptText = runtime.currentSegment.text || this.getSeedPrompt(simulation, partNumber, runtime.seedQuestionIndex || 0);
    this.appendTurnRecord(runtime, partNumber, promptText, transcript, payload.durationSeconds);

    const baseConversation = [
      ...(runtime.conversationHistory || []),
      { role: 'assistant' as const, content: promptText },
      { role: 'user' as const, content: transcript }
    ];

    const followUpCount = runtime.followUpCount || 0;
    if (followUpCount === 0 && this.shouldAskAdaptiveFollowUp(simulation, partNumber)) {
      const seedPrompt = this.getSeedPrompt(simulation, partNumber, runtime.seedQuestionIndex || 0);

      try {
        const followUp = await this.speechService.generateExaminerResponse(baseConversation, partNumber, {
          seedPrompt,
          followUpMode: 'single_narrow'
        });

        runtime.state = partNumber === 1 ? 'part1-examiner' : 'part3-examiner';
        runtime.retryCount = 0;
        runtime.retryBudgetRemaining = 1;
        runtime.followUpCount = 1;
        runtime.partFollowUpCount = (runtime.partFollowUpCount || 0) + 1;
        runtime.conversationHistory = [
          ...baseConversation,
          { role: 'assistant', content: followUp }
        ];
        runtime.currentSegment = {
          kind: 'dynamic_prompt',
          text: followUp
        };

        await simulation.save();
        return this.buildRuntimeResponse(simulation);
      } catch (error: any) {
        return this.handleRuntimeFailure(
          simulation,
          'examiner_generation',
          error?.message || 'Failed to generate examiner follow-up'
        );
      }
    }

    this.moveToNextSeedPrompt(simulation, partNumber);
    await simulation.save();
    return this.buildRuntimeResponse(simulation);
  }

  public async retryRuntimeStep(userId: string, simulationId: string, headers: IRequestHeaders) {
    const simulation = await this.getOwnedSimulation(userId, simulationId);
    const runtime = simulation.runtime;

    if (!runtime || runtime.state !== 'paused-retryable' || !runtime.previousState) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'No retryable runtime step available');
    }

    const logMessage = constructLogMessage(__filename, 'retryRuntimeStep', headers);
    this.log.info(`${logMessage} :: Retrying runtime step for simulation ${simulationId}`);

    runtime.state = runtime.previousState;
    runtime.previousState = undefined;
    runtime.lastError = undefined;
    runtime.failedStep = undefined;
    runtime.retryCount = 0;

    await simulation.save();
    return this.buildRuntimeResponse(simulation);
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

    const simulation = (await TestSimulationModel.findOne({
      _id: simulationId,
      user: userId
    })) as TestSimulationDocument | null;

    if (!simulation) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Simulation not found');
    }

    if (simulation.status === 'completed') {
      return simulation;
    }

    const preferences = await TestPreferenceModel.findOne({ user: userId }).lean();

    const partMap = new Map<number, any>((simulation.parts as any[]).map(part => [part.part, part] as const));

    const feedbackResults: IPracticeFeedback[] = [];
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
        preferences?.targetBand,
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
        generatedAt: new Date(),
        model: feedback.model
      };

      feedbackResults.push(part.feedback);
    }

    const aggregated = this.aggregateFeedback(feedbackResults);

    simulation.status = 'completed';
    simulation.completedAt = new Date();
    simulation.overallFeedback = aggregated;
    simulation.overallBand = aggregated.overallBand;

    await simulation.save();

    // Usage was already incremented at simulation start to prevent race conditions

    this.log.info(`${logMessage} :: Completed simulation ${simulationId}`);

    return simulation;
  }

  public async listSimulations(userId: string, options: SimulationListOptions) {
    return TestSimulationModel.find({ user: userId }).sort({ createdAt: -1 }).skip(options.offset).limit(options.limit);
  }

  public async getSimulation(userId: string, simulationId: string) {
    return TestSimulationModel.findOne({ _id: simulationId, user: userId });
  }

  private async getOwnedSimulation(userId: string, simulationId: string) {
    const simulation = (await TestSimulationModel.findOne({
      _id: simulationId,
      user: userId
    })) as TestSimulationDocument | null;

    if (!simulation) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Simulation not found');
    }

    if (!simulation.runtime) {
      simulation.runtime = this.buildInitialRuntime();
    }

    if (!simulation.sessionPackage) {
      simulation.sessionPackage = await this.sessionPackageService.buildSessionPackage(
        simulation.parts.map(part => ({
          part: part.part,
          topicId: part.topicId,
          topicTitle: part.topicTitle || part.topicId,
          question: part.question,
          timeLimit: part.timeLimit || 0,
          tips: part.tips || []
        }))
      );

      await simulation.save();
    }

    return simulation;
  }

  private buildRuntimeResponse(simulation: TestSimulationDocument): TestSimulationSessionResponseDto {
    return {
      simulationId: simulation._id,
      status: simulation.status,
      runtime: simulation.runtime,
      currentPart: simulation.parts.find(part => part.part === simulation.runtime?.currentPart),
      sessionPackage: simulation.sessionPackage
    };
  }

  private moveToCachedPhrase(
    simulation: TestSimulationDocument,
    partNumber: number,
    phraseId: Parameters<ExaminerPhraseService['getPhrase']>[0],
    state: TestSimulationRuntimeDto['state']
  ) {
    const phrase = this.examinerPhraseService.getPhrase(phraseId);
    const runtime = simulation.runtime!;
    runtime.state = state;
    runtime.currentPart = partNumber;
    runtime.currentSegment = {
      kind: 'cached_phrase',
      phraseId: phrase.id,
      text: phrase.text
    };
    runtime.conversationHistory = [];
    runtime.followUpCount = 0;
    runtime.partFollowUpCount = 0;
    runtime.seedQuestionIndex = 0;
    this.resetRetryBudget(runtime);
  }

  private moveToSeedQuestion(simulation: TestSimulationDocument, partNumber: 1 | 3, seedQuestionIndex: number) {
    const runtime = simulation.runtime!;
    const prompt = this.getSeedPrompt(simulation, partNumber, seedQuestionIndex);
    const isPartEntry = runtime.currentPart !== partNumber;

    runtime.state = partNumber === 1 ? 'part1-examiner' : 'part3-examiner';
    runtime.currentPart = partNumber;
    runtime.currentTurnIndex = seedQuestionIndex;
    runtime.seedQuestionIndex = seedQuestionIndex;
    runtime.followUpCount = 0;
    if (isPartEntry) {
      runtime.partFollowUpCount = 0;
    }
    runtime.conversationHistory = [];
    runtime.currentSegment = {
      kind: 'dynamic_prompt',
      text: prompt
    };
    this.resetRetryBudget(runtime);
  }

  private moveToNextSeedPrompt(simulation: TestSimulationDocument, partNumber: 1 | 3) {
    const runtime = simulation.runtime!;
    const nextSeedIndex = (runtime.seedQuestionIndex || 0) + 1;
    const prompts = this.getSeedPrompts(simulation, partNumber);

    if (nextSeedIndex < prompts.length) {
      this.moveToSeedQuestion(simulation, partNumber, nextSeedIndex);
      return;
    }

    if (partNumber === 1) {
      this.moveToCachedPhrase(simulation, 1, 'part1_transition', 'part1-transition');
      return;
    }

    this.moveToCachedPhrase(simulation, 3, 'test_complete', 'evaluation');
  }

  private shouldAskAdaptiveFollowUp(simulation: TestSimulationDocument, partNumber: 1 | 3) {
    const runtime = simulation.runtime!;
    const prompts = this.getSeedPrompts(simulation, partNumber);
    const completedSeedCount = (runtime.seedQuestionIndex || 0) + 1;
    const remainingSeedCount = Math.max(prompts.length - ((runtime.seedQuestionIndex || 0) + 1), 0);
    const promptBudget = this.getPromptBudget(partNumber);
    const partFollowUpCount = runtime.partFollowUpCount || 0;

    return partFollowUpCount < 1 && completedSeedCount + partFollowUpCount + 1 + remainingSeedCount <= promptBudget;
  }

  private appendTurnRecord(
    runtime: TestSimulationRuntimeDto,
    part: number,
    prompt: string,
    transcript: string,
    durationSeconds?: number
  ) {
    runtime.turnHistory = [
      ...(runtime.turnHistory || []),
      {
        part,
        prompt,
        transcript,
        durationSeconds
      }
    ];
  }

  private getSeedPrompts(simulation: TestSimulationDocument, partNumber: 1 | 3) {
    const part = simulation.parts.find(item => item.part === partNumber);
    if (!part) return [];

    return part.question
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0 && !item.startsWith('•') && item.toLowerCase() !== 'you should say:')
      .slice(0, this.getSeedPromptCap(partNumber));
  }

  private getSeedPrompt(simulation: TestSimulationDocument, partNumber: 1 | 3, seedQuestionIndex: number) {
    return this.getSeedPrompts(simulation, partNumber)[seedQuestionIndex] || '';
  }

  private getPartPromptText(simulation: TestSimulationDocument, partNumber: number) {
    return simulation.parts.find(part => part.part === partNumber)?.question || '';
  }

  private getSeedPromptCap(partNumber: 1 | 3) {
    return partNumber === 1 ? 4 : 3;
  }

  private getPromptBudget(partNumber: 1 | 3) {
    return partNumber === 1 ? 5 : 4;
  }

  private resetRetryBudget(runtime: TestSimulationRuntimeDto) {
    runtime.retryCount = 0;
    runtime.retryBudgetRemaining = 1;
    runtime.previousState = undefined;
    runtime.lastError = undefined;
    runtime.failedStep = undefined;
  }

  private async handleRuntimeFailure(
    simulation: TestSimulationDocument,
    failedStep: string,
    errorMessage: string
  ) {
    const runtime = simulation.runtime!;

    if ((runtime.retryBudgetRemaining ?? 1) <= 0) {
      runtime.state = 'failed-terminal';
      runtime.lastError = errorMessage;
      runtime.failedStep = failedStep;
      runtime.retryCount = 0;
      await simulation.save();
      return this.buildRuntimeResponse(simulation);
    }

    runtime.previousState = runtime.state;
    runtime.state = 'paused-retryable';
    runtime.lastError = errorMessage;
    runtime.failedStep = failedStep;
    runtime.retryCount = 1;
    runtime.retryBudgetRemaining = 0;

    await simulation.save();
    return this.buildRuntimeResponse(simulation);
  }

  private async buildSimulationParts(userId: string, headers: IRequestHeaders): Promise<SimulationPartDefinition[]> {
    const logMessage = constructLogMessage(__filename, 'buildSimulationParts', headers);

    try {
      // Get user's target band to determine difficulty
      const preferences = await TestPreferenceModel.findOne({ user: userId }).lean();
      const difficulty = this.determineDifficulty(preferences?.targetBand);

      // Generate AI-powered test questions
      const generatedTest = await this.questionGenerationService.generateCompleteTest(userId, difficulty, headers);

      const parts: SimulationPartDefinition[] = [];

      // Part 1: Warm-up questions
      parts.push({
        part: 1,
        topicId: generatedTest.part1.topic,
        topicTitle: generatedTest.part1.topic,
        question: generatedTest.part1.questions.join('\n'),
        timeLimit: generatedTest.part1.timeLimit,
        tips: ['Keep answers brief (30-60 seconds)', 'Give specific examples', 'Speak naturally and confidently']
      });

      // Part 2: Cue card
      const cueCardText = `${generatedTest.part2.mainPrompt}\n\nYou should say:\n${generatedTest.part2.bulletPoints.map(bp => `• ${bp}`).join('\n')}`;
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

      // Part 3: Discussion
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

  private aggregateFeedback(feedbackList: IPracticeFeedback[]): IPracticeFeedback {
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

    const average = (value: number) => (sums.count ? Number((value / sums.count).toFixed(1)) : undefined);

    return {
      overallBand: average(sums.overall),
      bandBreakdown: {
        pronunciation: average(sums.pronunciation),
        fluency: average(sums.fluency),
        lexicalResource: average(sums.lexical),
        grammaticalRange: average(sums.grammar)
      },
      summary: 'Completed IELTS speaking simulation with aggregated insights from all parts.',
      strengths: Array.from(sums.strengths),
      improvements: Array.from(sums.improvements)
    };
  }

  public paginateOptions(limit?: number, offset?: number): SimulationListOptions {
    return {
      limit: limit ?? 10,
      offset: offset ?? 0
    };
  }
}
