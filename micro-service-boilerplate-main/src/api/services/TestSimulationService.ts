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

import { FeedbackService } from './FeedbackService';
import { QuestionGenerationService } from './QuestionGenerationService';
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

@Service()
export class TestSimulationService {
  private log = new Logger(__filename);

  constructor(
    private readonly usageService: UsageService,
    private readonly feedbackService: FeedbackService,
    private readonly questionGenerationService: QuestionGenerationService
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
      startedAt: new Date()
    })) as TestSimulationDocument;

    this.log.info(`${logMessage} :: Started simulation ${simulation._id}`);

    return {
      simulationId: simulation._id,
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

    const preferences = await TestPreferenceModel.findOne({ user: userId }).lean<{ targetBand?: string }>();

    const partMap = new Map(simulation.parts.map(part => [part.part, part] as const));

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

  private async buildSimulationParts(userId: string, headers: IRequestHeaders): Promise<SimulationPartDefinition[]> {
    const logMessage = constructLogMessage(__filename, 'buildSimulationParts', headers);

    try {
      // Get user's target band to determine difficulty
      const preferences = await TestPreferenceModel.findOne({ user: userId }).lean<{ targetBand?: string }>();
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
