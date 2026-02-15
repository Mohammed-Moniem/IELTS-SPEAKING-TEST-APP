import { env } from '@env';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
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
      this.client = new OpenAI({ apiKey: env.openai.apiKey, baseURL: process.env.OPENAI_BASE_URL });
    }
  }

  /**
   * Generate a complete IELTS Speaking test (all 3 parts).
   *
   * Preference order:
   * 1. Serve from the seeded question bank (Postgres).
   * 2. Fall back to OpenAI generation if configured.
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

      const now = new Date();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      this.log.info(`${logMessage} :: Test served from question bank`);

      return {
        testId: randomUUID(),
        part1,
        part2,
        part3,
        generatedAt: now,
        expiresAt
      };
    } catch (error: any) {
      this.log.warn(`${logMessage} :: Question bank lookup failed`, { error: error?.message || error });
      return null;
    }
  }

  private async generateViaOpenAI(
    _userId: string,
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
        model: env.openai.model || 'gpt-4o-mini',
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

      const now = new Date();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      this.log.info(`${logMessage} :: Test generated via AI`);

      return {
        testId: randomUUID(),
        part1: parsed.part1,
        part2: parsed.part2,
        part3: parsed.part3,
        generatedAt: now,
        expiresAt
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

  private mapPart1(part1Rows: Array<{ question: string; topic: string }>): Part1Question {
    const questions = part1Rows.map(row => row.question).filter(Boolean);
    if (!questions.length) {
      questions.push('Tell me about yourself.');
    }

    return {
      topic: part1Rows[0]?.topic || 'Part 1 Warm-up',
      questions,
      timeLimit: 60
    };
  }

  private mapPart2(part2Row: { question: string; topic: string; cue_card?: any | null }): Part2CueCard {
    const cueCard = (part2Row as any).cue_card || {};
    const mainPrompt = part2Row.question || cueCard.mainTopic || 'Describe an experience that was important to you.';
    const bulletPoints = Array.isArray(cueCard.bulletPoints) && cueCard.bulletPoints.length
      ? cueCard.bulletPoints
      : this.buildFallbackCueCardBulletPoints(mainPrompt);

    const responseTime = Number(cueCard.responseTime ?? cueCard.timeToSpeak ?? 120);

    return {
      topic: part2Row.topic || cueCard.mainTopic || 'Part 2 Topic',
      mainPrompt,
      bulletPoints,
      preparationTime: Number(cueCard.preparationTime ?? 60),
      responseTime
    };
  }

  private mapPart3(part3Rows: Array<{ question: string; topic: string }>): Part3Question {
    const questions = part3Rows.map(row => row.question).filter(Boolean);
    if (!questions.length) {
      questions.push('What are the wider implications of this topic?');
    }

    return {
      topic: part3Rows[0]?.topic || 'Part 3 Discussion',
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

  private buildCompleteTestPrompt(difficulty: string): string {
    return `Generate a complete IELTS Speaking test for ${difficulty} level. Return ONLY valid JSON with this exact structure:

{
  \"part1\": {
    \"topic\": \"Work and Career\",
    \"questions\": [
      \"Do you work or are you a student?\",
      \"What do you enjoy most about your job/studies?\",
      \"How do you usually spend your weekends?\",
      \"Is there anything you would like to change about your current situation?\"
    ],
    \"timeLimit\": 60
  },
  \"part2\": {
    \"topic\": \"A memorable journey\",
    \"mainPrompt\": \"Describe a memorable journey you have taken\",
    \"bulletPoints\": [
      \"Where you went\",
      \"Who you went with\",
      \"What you did there\",
      \"And explain why this journey was memorable\"
    ],
    \"preparationTime\": 60,
    \"responseTime\": 120
  },
  \"part3\": {
    \"topic\": \"Travel and Tourism\",
    \"questions\": [
      \"How has tourism changed in your country over the past few decades?\",
      \"What are the positive and negative impacts of tourism on local communities?\",
      \"Do you think traveling abroad is essential for education? Why or why not?\",
      \"How might technology change the way people travel in the future?\"
    ],
    \"timeLimit\": 90
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
}

