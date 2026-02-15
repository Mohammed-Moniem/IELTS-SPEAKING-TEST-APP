import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { FullTestEvaluationRequestDto } from '@dto/TestEvaluationDto';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { Logger } from '@lib/logger';
import { getSupabaseAdmin } from '@lib/supabaseClient';
import { FullTestEvaluationPayload } from '@interfaces/ITestEvaluation';
import { StandardResponse } from '@responses/StandardResponse';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { Body, JsonController, Post, Req, Res } from 'routing-controllers';
import { Service } from 'typedi';

import { SpeechService } from '../services/SpeechService';
import { AudioStorageService } from '../services/AudioStorageService';
import { RecordingType } from '../models/AudioRecording';
import { env } from '@env';

// Configure multer storage to preserve file extensions.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = 'uploads/audio/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || getExtensionFromMimetype(file.mimetype);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${ext}`;
    cb(null, uniqueName);
  }
});

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
  return mimeMap[mimetype] || '.m4a';
}

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
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
    private audioStorageService: AudioStorageService
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
          const userId = (req as any)?.currentUser?.id as string | undefined;
          if (!userId) {
            if (file.path && fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
            return res.status(401).json({
              success: false,
              message: 'Authentication required'
            });
          }

          const language = (req.body.language as string) || 'en';
          const sessionId = String((req.body.sessionId as string) || '').trim() || randomUUID();
          const topic = typeof req.body.topic === 'string' ? req.body.topic.trim() : undefined;
          const testPart = typeof req.body.testPart === 'string' ? req.body.testPart.trim() : undefined;

          const result = await this.speechService.transcribe(file.path, language);

          const audioBuffer = fs.readFileSync(file.path);
          const recording = await this.audioStorageService.uploadAudio({
            userId,
            sessionId,
            audioBuffer,
            fileName: file.originalname || file.filename,
            mimeType: file.mimetype,
            recordingType: RecordingType.PRACTICE,
            durationSeconds: Math.max(0, Number(result.duration || 0)),
            topic,
            testPart,
            userTier: env.payments?.disabled ? 'pro' : ((req as any).currentUser?.plan as any)
          });

          fs.unlinkSync(file.path);

          return res.json({
            success: true,
            data: {
              ...result,
              sessionId,
              audioRecordingId: recording._id
            }
          });
        } catch (error: any) {
          this.log.error('Transcription error:', error);

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

      const response = await this.speechService.generateExaminerResponse(conversationHistory, testPart as 1 | 2 | 3, context);

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
  public async evaluateFullTest(
    @Body() body: FullTestEvaluationRequestDto,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<Response> {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'speech-evaluate-full');
    ensureResponseHeaders(res, headers);

    const userId = (req as any)?.currentUser?.id as string | undefined;
    if (!userId) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const durationSeconds = Math.max(0, Math.round(body.durationSeconds || 0));
      const sessionId = (body.testSessionId || '').trim() || randomUUID();
      const fullTranscript = (body.fullTranscript || '').trim() || this.buildFullTranscript(body.recordings || []);

      if (!fullTranscript) {
        return StandardResponse.validationError(res, [], 'Full transcript is required to evaluate the test', headers);
      }

      const parts = this.buildEvaluationParts(body.questions || [], body.recordings || []);

      const evaluationPayload: FullTestEvaluationPayload = {
        userId,
        fullTranscript,
        durationSeconds,
        metadata: body.metadata,
        parts
      };

      const evaluation = await this.speechService.evaluateFullTest(evaluationPayload);

      // Persist to analytics history so the Results/Analytics screens have something to show.
      const topic =
        body.questions?.find(q => q.category === 'part2' && q.topic)?.topic ||
        body.questions?.find(q => q.topic)?.topic ||
        'Full Test';

      const supabase = getSupabaseAdmin();
      await supabase.from('test_history').insert({
        user_id: userId,
        session_id: sessionId,
        test_type: 'simulation',
        topic,
        test_part: 'full',
        duration_seconds: durationSeconds,
        completed_at: body.metadata?.testCompletedAt || new Date().toISOString(),
        overall_band: evaluation.overallBand,
        criteria: evaluation.criteria,
        corrections: evaluation.corrections || [],
        suggestions: evaluation.suggestions || [],
        audio_recording_id: null,
        metadata: body.metadata || {}
      });

      const evaluationDoc = {
        _id: randomUUID(),
        testSessionId: sessionId,
        userId,
        overallBand: evaluation.overallBand,
        criteria: evaluation.criteria,
        spokenSummary: evaluation.spokenSummary,
        detailedFeedback: evaluation.detailedFeedback,
        corrections: evaluation.corrections,
        suggestions: evaluation.suggestions,
        partScores: evaluation.partScores,
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: 'ai',
        evaluatorModel: evaluation.evaluatorModel
      };

      return StandardResponse.success(
        res,
        {
          evaluation: evaluationDoc,
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
      return StandardResponse.error(res, error instanceof Error ? error : new Error(String(error || 'Unknown error')), headers);
    }
  }

  private buildFullTranscript(recordings: Array<{ transcript: string }>): string {
    return recordings
      .map(recording => (recording.transcript || '').trim())
      .filter(Boolean)
      .join('\n');
  }

  private buildEvaluationParts(
    questions: Array<{
      questionId?: string;
      question: string;
      category: 'part1' | 'part2' | 'part3';
      difficulty?: 'easy' | 'medium' | 'hard';
      topic?: string;
    }>,
    recordings: Array<{
      partNumber: 1 | 2 | 3;
      questionIndex: number;
      transcript: string;
      durationSeconds: number;
      recordingUrl?: string;
    }>
  ): FullTestEvaluationPayload['parts'] {
    const parts: FullTestEvaluationPayload['parts'] = [];

    for (const partNumber of [1, 2, 3] as const) {
      const partQuestions = questions
        .filter(q => this.categoryToPartNumber(q.category) === partNumber)
        .map(q => ({
          questionId: q.questionId,
          question: q.question,
          category: q.category,
          topic: q.topic,
          difficulty: q.difficulty || 'medium'
        }));

      const partResponses = recordings
        .filter(r => r.partNumber === partNumber)
        .map(r => ({
          transcript: r.transcript?.trim() || '',
          questionIndex: r.questionIndex,
          durationSeconds: Math.max(0, Math.round(r.durationSeconds || 0)),
          recordingUrl: r.recordingUrl
        }));

      if (partQuestions.length || partResponses.length) {
        parts.push({ partNumber, questions: partQuestions, responses: partResponses });
      }
    }

    return parts;
  }

  private categoryToPartNumber(category: 'part1' | 'part2' | 'part3'): 1 | 2 | 3 {
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
