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
import { PracticeService } from '@services/PracticeService';
import { TranscriptionService } from '@services/TranscriptionService';

@JsonController('/practice')
@UseBefore(AuthMiddleware)
export class PracticeController {
  constructor(
    private readonly practiceService: PracticeService,
    private readonly audioService: AudioService,
    private readonly transcriptionService: TranscriptionService
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
          }
        },
        'Audio processed successfully',
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
