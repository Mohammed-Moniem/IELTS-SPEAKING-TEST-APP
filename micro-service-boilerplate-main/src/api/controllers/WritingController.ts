import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Param, Post, QueryParams, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { WritingHistoryQuery, GenerateWritingTaskRequest, SubmitWritingRequest } from '@dto/WritingDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { WritingService } from '@services/WritingService';

@JsonController('/writing')
@UseBefore(AuthMiddleware)
export class WritingController {
  constructor(private readonly writingService: WritingService) {}

  @Post('/tasks/generate')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async generateTask(@Body() body: GenerateWritingTaskRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'writing-generate-task');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const track = body.track || 'academic';
      const taskType = body.taskType || 'task2';
      const task = await this.writingService.generateTask(req.currentUser.id, { track, taskType }, headers);
      return StandardResponse.success(res, task, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/submissions')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async submitWriting(@Body() body: SubmitWritingRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'writing-submit');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const submission = await this.writingService.submitWriting(
        req.currentUser.id,
        body.taskId,
        body.responseText,
        body.durationSeconds || 0,
        headers
      );
      return StandardResponse.created(res, submission, 'Writing submission evaluated', headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/submissions/:submissionId')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getSubmission(@Param('submissionId') submissionId: string, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'writing-submission-detail');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const submission = await this.writingService.getSubmission(req.currentUser.id, submissionId);
      return StandardResponse.success(res, submission, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/history')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getHistory(@QueryParams() query: WritingHistoryQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'writing-history');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const limit = query.limit ?? 20;
      const offset = query.offset ?? 0;
      const history = await this.writingService.getHistory(req.currentUser.id, limit, offset);
      return StandardResponse.success(res, history, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
