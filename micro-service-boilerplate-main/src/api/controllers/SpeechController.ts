import { Request, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { Body, JsonController, Post, Req, Res, UseBefore } from 'routing-controllers';
import { Service } from 'typedi';
import { Types } from '@lib/db/mongooseCompat';
import {
  FullTestEvaluationRecordingDto,
  FullTestEvaluationRequestDto,
  FullTestEvaluationQuestionDto
} from '@dto/TestEvaluationDto';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { TestEvaluationService } from '@services/TestEvaluationService';
import { TestSessionService } from '@services/TestSessionService';
import { FullTestEvaluationPayload } from '@interfaces/ITestEvaluation';
import { ITestQuestion, ITestRecording } from '@models/TestSessionModel';
import { Logger } from '../../lib/logger';
import { SpeechService } from '../services/SpeechService';
import { StandardResponse } from '@responses/StandardResponse';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';

// Configure multer storage to preserve file extensions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/audio/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Get file extension from original filename or mimetype
    const ext = path.extname(file.originalname) || getExtensionFromMimetype(file.mimetype);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${ext}`;
    cb(null, uniqueName);
  }
});

// Helper function to get extension from mimetype
function getExtensionFromMimetype(mimetype: string): string {
  const mimeMap: Record<string, string> = {
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/m4a': '.m4a',
    'audio/wav': '.wav',
    'audio/wave': '.wav',
    'audio/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/flac': '.flac'
  };
  return mimeMap[mimetype] || '.m4a'; // Default to .m4a
}

// Configure multer for file uploads
const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/m4a', 'audio/ogg', 'audio/flac'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp3|mp4|wav|webm|m4a|ogg|flac)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

@JsonController('/speech')
@Service()
export class SpeechController {
  private log = new Logger(__filename);

  constructor(
    private speechService: SpeechService,
    private testEvaluationService: TestEvaluationService,
    private testSessionService: TestSessionService
  ) {}

  @Post('/transcribe')
  public async transcribe(@Req() req: Request, @Res() res: Response): Promise<any> {
    return new Promise((_resolve, _reject) => {
      upload.single('audio')(req, res, async err => {
        if (err) {
          this.log.error('File upload error:', err);
          return res.status(400).json({
            success: false,
            message: 'File upload failed',
            error: err.message
          });
        }

        const file = req.file;
        if (!file) {
          return res.status(400).json({
            success: false,
            message: 'No audio file provided'
          });
        }

        try {
          const language = (req.body.language as string) || 'en';
          const result = await this.speechService.transcribe(file.path, language);

          // Clean up uploaded file
          fs.unlinkSync(file.path);

          return res.json({
            success: true,
            data: result
          });
        } catch (error: any) {
          this.log.error('Transcription error:', error);

          // Clean up uploaded file on error
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }

          return res.status(500).json({
            success: false,
            message: 'Transcription failed',
            error: error?.message || 'Unknown error'
          });
        }
      });
    });
  }

  @Post('/synthesize')
  public async synthesize(
    @Body()
    body: {
      text: string;
      voiceId?: string;
      speed?: number;
      stability?: number;
      useSpeakerBoost?: boolean;
      cacheKey?: string;
      modelId?: string;
      optimizeStreamingLatency?: number;
    },
    @Res() res: Response
  ): Promise<Response> {
    try {
      const { text, voiceId, stability, useSpeakerBoost, cacheKey, modelId, optimizeStreamingLatency, speed } = body;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Text is required'
        });
      }

      this.log.info(`Synthesizing speech for text: ${text.substring(0, 60)}...`);

      const synthesis = await this.speechService.synthesize(text, {
        voiceId,
        stability,
        useSpeakerBoost,
        cacheKey,
        modelId,
        optimizeStreamingLatency,
        speed
      });

      const audioBase64 = synthesis.buffer.toString('base64');

      return res.json({
        success: true,
        data: {
          audioBase64,
          mimeType: 'audio/mpeg',
          voiceId: synthesis.voiceId,
          cacheHit: synthesis.cacheHit,
          cacheExpiresAt: synthesis.cacheExpiresAt ? new Date(synthesis.cacheExpiresAt).toISOString() : null,
          textLength: text.length
        }
      });
    } catch (error: any) {
      this.log.error('Synthesis error:', error);
      return res.status(500).json({
        success: false,
        message: 'Speech synthesis failed',
        error: error?.message || 'Unknown error'
      });
    }
  }

  @Post('/examiner/chat')
  public async examinerChat(
    @Body()
    body: {
      conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      testPart: number;
      context?: { topic?: string; timeRemaining?: number; userLevel?: string };
    }
  ): Promise<any> {
    try {
      const { conversationHistory, testPart, context } = body;

      if (!conversationHistory || conversationHistory.length === 0) {
        return {
          success: false,
          message: 'Conversation history is required'
        };
      }

      if (!testPart || ![1, 2, 3].includes(testPart)) {
        return {
          success: false,
          message: 'Valid test part (1, 2, or 3) is required'
        };
      }

      this.log.info(`Generating examiner response for Part ${testPart}`);

      const response = await this.speechService.generateExaminerResponse(
        conversationHistory,
        testPart as 1 | 2 | 3,
        context
      );

      return {
        success: true,
        data: {
          response,
          testPart
        }
      };
    } catch (error: any) {
      this.log.error('Examiner chat error:', error);
      return {
        success: false,
        message: 'Failed to generate examiner response',
        error: error?.message || 'Unknown error'
      };
    }
  }

  @Post('/evaluate')
  public async evaluate(@Body() body: { transcript: string; question: string; testPart: number }): Promise<any> {
    try {
      const { transcript, question, testPart } = body;

      if (!transcript || transcript.trim().length === 0) {
        return {
          success: false,
          message: 'Transcript is required'
        };
      }

      if (!question || question.trim().length === 0) {
        return {
          success: false,
          message: 'Question is required'
        };
      }

      if (!testPart || ![1, 2, 3].includes(testPart)) {
        return {
          success: false,
          message: 'Valid test part (1, 2, or 3) is required'
        };
      }

      this.log.info(`Evaluating response for Part ${testPart}`);

      const evaluation = await this.speechService.evaluateResponse(transcript, question, testPart as 1 | 2 | 3);

      return {
        success: true,
        data: evaluation
      };
    } catch (error: any) {
      this.log.error('Evaluation error:', error);
      return {
        success: false,
        message: 'Failed to evaluate response',
        error: error?.message || 'Unknown error'
      };
    }
  }

  @Post('/evaluate-full-test')
  @UseBefore(AuthMiddleware)
  public async evaluateFullTest(
    @Body() body: FullTestEvaluationRequestDto,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<Response> {
    const userId = (req as any).currentUser?.id;

    const headers: IRequestHeaders = buildRequestHeaders(req, 'speech-evaluate-full');
    ensureResponseHeaders(res, headers);

    if (!userId) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const sessionQuestions = this.mapEvaluationQuestions(body.questions || []);
      const sessionRecordings = this.mapEvaluationRecordings(body.recordings || []);
      const durationSeconds = Math.max(0, Math.round(body.durationSeconds || 0));
      const fullTranscript = (body.fullTranscript || '').trim() || this.buildFullTranscript(sessionRecordings);

      if (!fullTranscript) {
        return StandardResponse.validationError(res, [], 'Full transcript is required to evaluate the test', headers);
      }

      let sessionId = body.testSessionId;
      let sessionDocument = null;

      if (sessionId && Types.ObjectId.isValid(sessionId)) {
        sessionDocument = await this.testSessionService.getSession(sessionId, headers);
      }

      if (!sessionDocument) {
        const createdSession = await this.testSessionService.createSession(
          {
            userId,
            testType: 'full-test',
            part: 'full',
            difficulty: this.deriveSessionDifficulty(body.metadata?.difficulty, sessionQuestions),
            fullTranscript,
            duration: durationSeconds,
            metadata: {
              ...(body.metadata || {}),
              source: (body.metadata as any)?.source || 'mobile-app'
            }
          },
          headers
        );

        sessionDocument = createdSession;
        sessionId = createdSession._id.toString();
      }

      if (sessionQuestions.length) {
        await this.testSessionService.updateSession(sessionId, { questions: sessionQuestions }, headers);
      }

      await this.testSessionService.completeSession(
        sessionId,
        {
          fullTranscript,
          duration: durationSeconds,
          recordings: sessionRecordings
        },
        headers
      );

      const evaluationPayload: FullTestEvaluationPayload = {
        userId,
        fullTranscript,
        durationSeconds,
        metadata: body.metadata,
        parts: this.buildEvaluationParts(sessionQuestions, sessionRecordings)
      };

      const evaluation = await this.speechService.evaluateFullTest(evaluationPayload);

      const evaluationDoc = await this.testEvaluationService.upsertEvaluation(
        {
          testSessionId: sessionId!,
          userId,
          overallBand: evaluation.overallBand,
          criteria: evaluation.criteria,
          spokenSummary: evaluation.spokenSummary,
          detailedFeedback: evaluation.detailedFeedback,
          corrections: evaluation.corrections,
          suggestions: evaluation.suggestions,
          evaluatedAt: new Date(),
          evaluatedBy: 'ai',
          evaluatorModel: evaluation.evaluatorModel,
          partScores: evaluation.partScores
        },
        headers
      );

      await this.testSessionService.updateSession(sessionId!, { evaluationId: evaluationDoc._id }, headers);

      const evaluationData = evaluationDoc.toObject ? evaluationDoc.toObject({ getters: true }) : evaluationDoc;

      if (evaluationData?._id?.toString) {
        evaluationData._id = evaluationData._id.toString();
      }

      if (evaluationData?.testSessionId?.toString) {
        evaluationData.testSessionId = evaluationData.testSessionId.toString();
      }

      return StandardResponse.success(
        res,
        {
          evaluation: evaluationData,
          overallBand: evaluation.overallBand,
          partScores: evaluation.partScores,
          spokenSummary: evaluation.spokenSummary,
          testSessionId: sessionId
        },
        undefined,
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error: any) {
      this.log.error('Full test evaluation error:', error);

      if (error?.name === 'ValidationError') {
        const validationMessages = Object.values(error.errors || {}).map((err: any) => err.message);
        return StandardResponse.validationError(res, validationMessages, error.message, headers);
      }

      return StandardResponse.error(
        res,
        error instanceof Error ? error : new Error(String(error || 'Unknown error')),
        headers
      );
    }
  }

  private mapEvaluationQuestions(questions: FullTestEvaluationQuestionDto[]): ITestQuestion[] {
    const mapped: ITestQuestion[] = [];

    for (const question of questions) {
      if (!question.questionId || !Types.ObjectId.isValid(question.questionId)) {
        this.log.warn('Skipping question without valid ObjectId', { question: question.question });
        continue;
      }

      mapped.push({
        questionId: new Types.ObjectId(question.questionId),
        question: question.question,
        category: question.category,
        difficulty: question.difficulty || 'medium',
        topic: question.topic
      });
    }

    return mapped;
  }

  private mapEvaluationRecordings(recordings: FullTestEvaluationRecordingDto[]): ITestRecording[] {
    return recordings.map(recording => ({
      partNumber: recording.partNumber,
      questionIndex: recording.questionIndex,
      transcript: recording.transcript?.trim() || '',
      duration: Math.max(0, Math.round(recording.durationSeconds || 0)),
      recordingUrl: recording.recordingUrl,
      audioData: recording.audioData
    }));
  }

  private buildFullTranscript(recordings: ITestRecording[]): string {
    return recordings
      .map(recording => (recording.transcript || '').trim())
      .filter(Boolean)
      .join('\n');
  }

  private buildEvaluationParts(
    questions: ITestQuestion[],
    recordings: ITestRecording[]
  ): FullTestEvaluationPayload['parts'] {
    const parts: FullTestEvaluationPayload['parts'] = [];

    for (const partNumber of [1, 2, 3] as const) {
      const partQuestions = questions
        .filter(question => this.categoryToPartNumber(question.category) === partNumber)
        .map(question => ({
          questionId: question.questionId.toString(),
          question: question.question,
          category: question.category,
          topic: question.topic,
          difficulty: question.difficulty
        }));

      const partResponses = recordings
        .filter(recording => recording.partNumber === partNumber)
        .map(recording => ({
          transcript: recording.transcript,
          questionIndex: recording.questionIndex,
          durationSeconds: recording.duration,
          recordingUrl: recording.recordingUrl
        }));

      if (partQuestions.length || partResponses.length) {
        parts.push({
          partNumber,
          questions: partQuestions,
          responses: partResponses
        });
      }
    }

    return parts;
  }

  private deriveSessionDifficulty(
    provided: 'beginner' | 'intermediate' | 'advanced' | undefined,
    questions: ITestQuestion[]
  ): 'beginner' | 'intermediate' | 'advanced' {
    if (provided === 'beginner' || provided === 'intermediate' || provided === 'advanced') {
      return provided;
    }

    const referenceQuestion = questions.find(question => question?.difficulty);
    switch (referenceQuestion?.difficulty) {
      case 'easy':
        return 'beginner';
      case 'hard':
        return 'advanced';
      default:
        return 'intermediate';
    }
  }

  private categoryToPartNumber(category: ITestQuestion['category']): 1 | 2 | 3 {
    switch (category) {
      case 'part1':
        return 1;
      case 'part2':
        return 2;
      case 'part3':
      default:
        return 3;
    }
  }
}
