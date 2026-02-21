import { env } from '@env';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { GeneratedQuestionModel, IGeneratedQuestion } from '@models/GeneratedQuestionModel';
import { IELTSQuestionDocument } from '@models/IELTSQuestionModel';
import OpenAI from 'openai';
import { Service } from 'typedi';
import { IELTSQuestionService } from './IELTSQuestionService';

interface Part1Question {
  topic: string;
  questions: string[];
  timeLimit: number; // seconds per question
}

interface Part2CueCard {
  topic: string;
  mainPrompt: string;
  bulletPoints: string[];
  preparationTime: number; // 60 seconds
  responseTime: number; // 120 seconds
}

interface Part3Question {
  topic: string;
  questions: string[];
  timeLimit: number; // seconds per question
}

export interface GeneratedTestStructure {
  testId: string;
  part1: Part1Question;
  part2: Part2CueCard;
  part3: Part3Question;
  generatedAt: Date;
  expiresAt: Date;
}

@Service()
export class QuestionGenerationService {
  private log = new Logger(__filename);
  private client?: OpenAI;

  constructor(private readonly questionBankService: IELTSQuestionService) {
    if (env.openai.apiKey) {
      this.client = new OpenAI({ apiKey: env.openai.apiKey });
    }
  }

  /**
   * Generate a complete IELTS Speaking test (all 3 parts)
   */
  public async generateCompleteTest(
    userId: string,
    difficulty: 'beginner' | 'intermediate' | 'advanced',
    headers: IRequestHeaders
  ): Promise<GeneratedTestStructure> {
    const logMessage = constructLogMessage(__filename, 'generateCompleteTest', headers);
    this.log.info(`${logMessage} :: Generating ${difficulty} test for user ${userId}`);

    const questionBankResult = await this.generateFromQuestionBank(userId, difficulty, headers, logMessage);
    if (questionBankResult) {
      return questionBankResult;
    }

    this.log.warn(`${logMessage} :: Falling back to AI question generation`);

    if (!this.client) {
      throw new CSError(
        HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
        CODES.GenericErrorMessage,
        'Question bank unavailable and AI generation disabled'
      );
    }

    return this.generateViaOpenAI(userId, difficulty, headers, logMessage);
  }

  private async generateFromQuestionBank(
    userId: string,
    difficulty: 'beginner' | 'intermediate' | 'advanced',
    headers: IRequestHeaders,
    logMessage: string
  ): Promise<GeneratedTestStructure | null> {
    try {
      const selection = await this.questionBankService.buildFullTestFromBank(userId, difficulty, headers);
      if (!selection || !selection.part2) {
        return null;
      }

      const part1 = this.mapPart1(selection.part1);
      const part2 = this.mapPart2(selection.part2);
      const part3 = this.mapPart3(selection.part3);

      const questionDoc = await GeneratedQuestionModel.create({
        userId,
        difficulty,
        part1,
        part2,
        part3,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      this.log.info(`${logMessage} :: Test served from question bank, ID: ${questionDoc._id}`);

      return {
        testId: questionDoc._id.toString(),
        part1,
        part2,
        part3,
        generatedAt: questionDoc.generatedAt,
        expiresAt: questionDoc.expiresAt
      };
    } catch (error: any) {
      this.log.warn(`${logMessage} :: Question bank lookup failed`, { error: error.message });
      return null;
    }
  }

  private async generateViaOpenAI(
    userId: string,
    difficulty: 'beginner' | 'intermediate' | 'advanced',
    headers: IRequestHeaders,
    logMessage: string
  ): Promise<GeneratedTestStructure> {
    if (!this.client) {
      throw new CSError(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE, CODES.GenericErrorMessage, 'AI service unavailable');
    }

    try {
      const prompt = this.buildCompleteTestPrompt(difficulty);

      const completion = await this.client.chat.completions.create({
        model: env.openai.model || 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'You are an IELTS speaking test examiner. Generate realistic, varied IELTS speaking test questions following official format and standards.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content);

      const questionDoc = await GeneratedQuestionModel.create({
        userId,
        difficulty,
        part1: parsed.part1,
        part2: parsed.part2,
        part3: parsed.part3,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      this.log.info(`${logMessage} :: Test generated via AI, ID: ${questionDoc._id}`);

      return {
        testId: questionDoc._id.toString(),
        part1: parsed.part1,
        part2: parsed.part2,
        part3: parsed.part3,
        generatedAt: questionDoc.generatedAt,
        expiresAt: questionDoc.expiresAt
      };
    } catch (error: any) {
      this.log.error(`${logMessage} :: Failed to generate test`, { error: error.message });
      throw new CSError(
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        CODES.GenericErrorMessage,
        'Failed to generate test questions'
      );
    }
  }

  private mapPart1(part1Docs: IELTSQuestionDocument[]): Part1Question {
    const questions = part1Docs.map(doc => doc.question).filter(Boolean);
    if (!questions.length) {
      questions.push('Tell me about yourself.');
    }

    return {
      topic: part1Docs[0]?.topic || 'Part 1 Warm-up',
      questions,
      timeLimit: 60
    };
  }

  private mapPart2(part2Doc: IELTSQuestionDocument): Part2CueCard {
    const cueCard = part2Doc.cueCard || {};
    const mainPrompt = part2Doc.question || cueCard.mainTopic || 'Describe an experience that was important to you.';
    const bulletPoints =
      cueCard.bulletPoints && cueCard.bulletPoints.length
        ? cueCard.bulletPoints
        : this.buildFallbackCueCardBulletPoints(mainPrompt);

    const responseTime =
      (cueCard as { timeToSpeak?: number; responseTime?: number }).responseTime ?? cueCard.timeToSpeak ?? 120;

    return {
      topic: part2Doc.topic || cueCard.mainTopic || 'Part 2 Topic',
      mainPrompt,
      bulletPoints,
      preparationTime: cueCard.preparationTime ?? 60,
      responseTime
    };
  }

  private mapPart3(part3Docs: IELTSQuestionDocument[]): Part3Question {
    const questions = part3Docs.map(doc => doc.question).filter(Boolean);
    if (!questions.length) {
      questions.push('What are the wider implications of this topic?');
    }

    return {
      topic: part3Docs[0]?.topic || 'Part 3 Discussion',
      questions,
      timeLimit: 90
    };
  }

  private buildFallbackCueCardBulletPoints(mainPrompt: string): string[] {
    const prompt = mainPrompt.trim().replace(/\.$/, '');
    return [
      `What ${prompt.toLowerCase().startsWith('describe') ? 'it is about' : 'happened'}`,
      'When it happened',
      'Who was involved',
      'Why it is significant to you'
    ];
  }

  /**
   * Generate practice questions for a specific topic
   */
  public async generatePracticeQuestions(
    topicSlug: string,
    part: 1 | 2 | 3,
    count: number,
    headers: IRequestHeaders
  ): Promise<string[]> {
    const logMessage = constructLogMessage(__filename, 'generatePracticeQuestions', headers);

    if (!this.client) {
      return this.getFallbackQuestions(topicSlug, part, count);
    }

    try {
      const prompt = this.buildPracticePrompt(topicSlug, part, count);

      const completion = await this.client.chat.completions.create({
        model: env.openai.model || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an IELTS examiner creating practice questions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return this.getFallbackQuestions(topicSlug, part, count);
      }

      const parsed = JSON.parse(content);
      return parsed.questions || this.getFallbackQuestions(topicSlug, part, count);
    } catch (error: any) {
      this.log.warn(`${logMessage} :: Failed to generate questions, using fallback`, { error: error.message });
      return this.getFallbackQuestions(topicSlug, part, count);
    }
  }

  /**
   * Retrieve previously generated test
   */
  public async getGeneratedTest(testId: string, userId: string): Promise<IGeneratedQuestion | null> {
    return GeneratedQuestionModel.findOne({
      _id: testId,
      userId,
      expiresAt: { $gt: new Date() }
    });
  }

  private buildCompleteTestPrompt(difficulty: string): string {
    return `Generate a complete IELTS Speaking test for ${difficulty} level. Return ONLY valid JSON with this exact structure:

{
  "part1": {
    "topic": "Work and Career",
    "questions": [
      "Do you work or are you a student?",
      "What do you enjoy most about your job/studies?",
      "How do you usually spend your weekends?",
      "Is there anything you would like to change about your current situation?"
    ],
    "timeLimit": 60
  },
  "part2": {
    "topic": "A memorable journey",
    "mainPrompt": "Describe a memorable journey you have taken",
    "bulletPoints": [
      "Where you went",
      "Who you went with",
      "What you did there",
      "And explain why this journey was memorable"
    ],
    "preparationTime": 60,
    "responseTime": 120
  },
  "part3": {
    "topic": "Travel and Tourism",
    "questions": [
      "How has tourism changed in your country over the past few decades?",
      "What are the positive and negative impacts of tourism on local communities?",
      "Do you think traveling abroad is essential for education? Why or why not?",
      "How might technology change the way people travel in the future?"
    ],
    "timeLimit": 90
  }
}

Guidelines:
- Part 1: 4 simple, familiar questions (work, family, hobbies, daily life)
- Part 2: 1 cue card with clear topic and 4 bullet points for 2-minute speech
- Part 3: 4 abstract, analytical questions related to Part 2 topic
- Ensure Part 3 questions build on Part 2 theme but go deeper
- ${difficulty === 'beginner' ? 'Use simpler vocabulary and straightforward questions' : ''}
- ${difficulty === 'advanced' ? 'Use complex structures and thought-provoking questions' : ''}`;
  }

  private buildPracticePrompt(topicSlug: string, part: number, count: number): string {
    const partDescriptions = {
      1: 'simple, familiar questions about daily life, work, hobbies, or family',
      2: 'a cue card with a clear topic and 4 bullet points for a 2-minute speech',
      3: 'abstract, analytical discussion questions requiring in-depth answers'
    };

    return `Generate ${count} IELTS Speaking Part ${part} questions about "${topicSlug}".
Part ${part} focuses on: ${partDescriptions[part as keyof typeof partDescriptions]}

Return ONLY valid JSON:
{
  "questions": ["Question 1", "Question 2", ...]
}`;
  }

  private getFallbackQuestions(topicSlug: string, part: number, count: number): string[] {
    const fallbacks: Record<string, string[]> = {
      hometown: [
        'Where are you from?',
        'What do you like most about your hometown?',
        'Has your hometown changed much in recent years?'
      ],
      work: ['Do you work or are you a student?', 'What do you enjoy about your job?', 'What are your career goals?'],
      hobbies: [
        'What do you do in your free time?',
        'Do you have any hobbies?',
        'How did you become interested in them?'
      ]
    };

    return fallbacks[topicSlug]?.slice(0, count) || [`Tell me about ${topicSlug}`];
  }
}
