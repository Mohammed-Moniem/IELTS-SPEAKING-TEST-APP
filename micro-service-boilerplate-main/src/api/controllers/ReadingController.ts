import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Param, Post, QueryParams, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { ReadingHistoryQuery, StartReadingTestRequest, SubmitReadingTestRequest } from '@dto/ReadingDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { ReadingService } from '@services/ReadingService';

@JsonController('/reading')
@UseBefore(AuthMiddleware)
export class ReadingController {
  constructor(private readonly readingService: ReadingService) {}

  @Post('/tests/start')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async startTest(@Body() body: StartReadingTestRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'reading-start');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const attempt = await this.readingService.startTest(req.currentUser.id, body.track || 'academic', headers);
      return StandardResponse.created(res, attempt, 'Reading test started', headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/tests/:attemptId/submit')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async submitTest(
    @Param('attemptId') attemptId: string,
    @Body() body: SubmitReadingTestRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'reading-submit');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const attempt = await this.readingService.submitTest(
        req.currentUser.id,
        attemptId,
        body.answers,
        body.durationSeconds || 0,
        headers
      );
      return StandardResponse.success(res, attempt, 'Reading test submitted', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/tests/:attemptId')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getAttempt(@Param('attemptId') attemptId: string, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'reading-attempt-detail');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const attempt = await this.readingService.getAttempt(req.currentUser.id, attemptId);
      return StandardResponse.success(res, attempt, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/history')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getHistory(@QueryParams() query: ReadingHistoryQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'reading-history');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const history = await this.readingService.getHistory(req.currentUser.id, query.limit ?? 20, query.offset ?? 0, {
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
