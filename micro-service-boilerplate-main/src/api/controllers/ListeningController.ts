import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Param, Post, QueryParams, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { ListeningHistoryQuery, SaveListeningProgressRequest, StartListeningTestRequest, SubmitListeningTestRequest } from '@dto/ListeningDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { ListeningService } from '@services/ListeningService';

@JsonController('/listening')
@UseBefore(AuthMiddleware)
export class ListeningController {
  constructor(private readonly listeningService: ListeningService) {}

  @Post('/tests/start')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async startTest(@Body() body: StartListeningTestRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'listening-start');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const attempt = await this.listeningService.startTest(req.currentUser.id, body.track || 'academic', headers);
      return StandardResponse.created(res, attempt, 'Listening test started', headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/tests/:attemptId/submit')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async submitTest(
    @Param('attemptId') attemptId: string,
    @Body() body: SubmitListeningTestRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'listening-submit');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const attempt = await this.listeningService.submitTest(
        req.currentUser.id,
        attemptId,
        body.answers,
        body.durationSeconds || 0,
        headers
      );
      return StandardResponse.success(res, attempt, 'Listening test submitted', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/tests/:attemptId/progress')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async saveProgress(
    @Param('attemptId') attemptId: string,
    @Body() body: SaveListeningProgressRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'listening-progress');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const attempt = await this.listeningService.saveProgress(req.currentUser.id, attemptId, body, headers);
      return StandardResponse.success(res, attempt, 'Progress saved', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/tests/:attemptId')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getAttempt(@Param('attemptId') attemptId: string, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'listening-attempt-detail');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const attempt = await this.listeningService.getAttempt(req.currentUser.id, attemptId);
      return StandardResponse.success(res, attempt, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/history')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getHistory(@QueryParams() query: ListeningHistoryQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'listening-history');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const history = await this.listeningService.getHistory(req.currentUser.id, query.limit ?? 20, query.offset ?? 0, {
        track: query.track,
        from: query.from,
        to: query.to
      });
      return StandardResponse.success(res, history, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
