import { Request, Response } from 'express';
import {
  Body,
  Get,
  HttpCode,
  JsonController,
  Params,
  Post,
  QueryParams,
  Req,
  Res,
  UploadedFile,
  UseBefore
} from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import {
  CompletePracticeSessionRequest,
  PracticeHistoryQuery,
  PracticeSessionParam,
  StartPracticeRequest
} from '@dto/PracticeDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { aiRateLimiter, sessionStartRateLimiter } from '@middlewares/rateLimitMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { AudioService } from '@services/AudioService';
import { RecordingType } from '@models/AudioRecording';
import { AudioStorageService } from '@services/AudioStorageService';
import { PracticeService } from '@services/PracticeService';
import { TranscriptionService } from '@services/TranscriptionService';
import { getSupabaseAdmin } from '@lib/supabaseClient';
import { env } from '@env';

@JsonController('/practice')
@UseBefore(AuthMiddleware)
export class PracticeController {
  constructor(
    private readonly practiceService: PracticeService,
    private readonly audioService: AudioService,
    private readonly transcriptionService: TranscriptionService,
    private readonly audioStorageService: AudioStorageService
  ) {}

  @Post('/sessions')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  @UseBefore(sessionStartRateLimiter)
  public async startSession(@Body() body: StartPracticeRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'practice-start');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const session = await this.practiceService.startSession(req.currentUser.id, body.topicId, headers);
      return StandardResponse.created(res, session, 'Practice session started', headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/sessions/:sessionId/complete')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  @UseBefore(aiRateLimiter)
  public async completeSession(
    @Params() params: PracticeSessionParam,
    @Body() body: CompletePracticeSessionRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'practice-complete');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const session = await this.practiceService.completeSession(
        req.currentUser.id,
        params.sessionId,
        body.userResponse,
        body.timeSpent,
        headers
      );
      return StandardResponse.success(res, session, 'Practice session completed', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/sessions')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listSessions(@QueryParams() query: PracticeHistoryQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'practice-list');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    const limit = query.limit ?? 10;
    const offset = query.offset ?? 0;

    try {
      const sessions = await this.practiceService.listSessions(
        req.currentUser.id,
        limit,
        offset,
        query.topicId,
        headers
      );
      return StandardResponse.success(res, sessions, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  /**
   * Upload audio recording for a practice session
   * Endpoint: POST /api/v1/practice/sessions/:sessionId/audio
   */
  @Post('/sessions/:sessionId/audio')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async uploadAudio(
    @Params() params: PracticeSessionParam,
    @UploadedFile('audio') file: Express.Multer.File,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'practice-audio-upload');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    if (!file) {
      return StandardResponse.error(res, 'No audio file provided', headers);
    }

    try {
      // Save audio file
      const audioMetadata = await this.audioService.saveAudioFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        headers
      );

      // Transcribe audio
      const transcription = await this.transcriptionService.transcribeAudio(audioMetadata.filePath, 'en', headers);

      // Complete session with transcribed text
      const session = await this.practiceService.completeSession(
        req.currentUser.id,
        params.sessionId,
        transcription.text,
        undefined, // timeSpent will be calculated from audio duration
        headers
      );

      // Upload recording to Supabase Storage + create audio_recordings metadata row.
      let audioRecordingId: string | undefined;
      try {
        const scores = session.feedback?.bandBreakdown
          ? {
              pronunciation: session.feedback.bandBreakdown.pronunciation,
              fluencyCoherence: session.feedback.bandBreakdown.fluency,
              lexicalResource: session.feedback.bandBreakdown.lexicalResource,
              grammaticalRange: session.feedback.bandBreakdown.grammaticalRange
            }
          : undefined;

        const recording = await this.audioStorageService.uploadAudio({
          userId: req.currentUser.id,
          sessionId: params.sessionId,
          audioBuffer: file.buffer,
          fileName: file.originalname,
          mimeType: file.mimetype,
          recordingType: RecordingType.PRACTICE,
          durationSeconds: Math.max(0, Number(transcription.duration || 0)),
          topic: session.topicTitle,
          testPart: `part${session.part}`,
          overallBand: session.feedback?.overallBand,
          scores,
          userTier: env.payments?.disabled ? 'pro' : (req.currentUser.plan as any)
        });

        audioRecordingId = recording._id as string;

        const supabase = getSupabaseAdmin();
        await supabase
          .from('practice_sessions')
          .update({
            audio_recording_id: audioRecordingId,
            audio_path: (recording.metadata as any)?.objectPath || session.audioUrl || null
          })
          .eq('id', params.sessionId)
          .eq('user_id', req.currentUser.id);
      } catch (audioError: any) {
        // Don't fail the user flow if storage upload fails; they still get feedback.
        // Logging happens in AudioStorageService.
        audioRecordingId = undefined;
      }

      // Clean up audio file after processing
      await this.audioService.deleteAudioFile(audioMetadata.filePath, headers);

      return StandardResponse.success(
        res,
        {
          session,
          transcription: {
            text: transcription.text,
            confidence: transcription.confidence,
            duration: transcription.duration
          },
          audioRecordingId
        },
        'Audio processed successfully',
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  /**
   * Finalize a voice practice session (client-side voice UX persists to backend history)
   * Endpoint: POST /api/v1/practice/voice-complete
   */
  @Post('/voice-complete')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  @UseBefore(aiRateLimiter)
  public async voiceComplete(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'practice-voice-complete');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const planRaw = String(req.currentUser.plan || '').trim();
      const plan = planRaw === 'premium' || planRaw === 'pro' ? planRaw : 'free';
      const session = await this.practiceService.completeVoiceSession({
        userId: req.currentUser.id,
        plan: plan as any,
        payload: body,
        headers
      });

      return StandardResponse.success(res, session, 'Voice practice saved', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
