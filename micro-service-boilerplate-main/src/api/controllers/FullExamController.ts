import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Param, Post, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { FullExamRuntimeMutationRequest, StartFullExamRequest, SubmitFullExamSectionRequest } from '@dto/FullExamDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { FullExamService } from '@services/FullExamService';

@JsonController('/exams/full')
@UseBefore(AuthMiddleware)
export class FullExamController {
  constructor(private readonly fullExamService: FullExamService) {}

  @Post('/start')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async start(@Body() body: StartFullExamRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'full-exam-start');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const exam = await this.fullExamService.startExam(req.currentUser.id, body.track || 'academic', headers);
      return StandardResponse.created(res, exam, 'Full exam started', headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/:examId/section/:module/submit')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async submitSection(
    @Param('examId') examId: string,
    @Param('module') module: SubmitFullExamSectionRequest['module'],
    @Body() body: SubmitFullExamSectionRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'full-exam-submit-section');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const exam = await this.fullExamService.submitSection(
        req.currentUser.id,
        examId,
        module,
        body.attemptId,
        body.score,
        headers
      );
      return StandardResponse.success(res, exam, 'Section submitted', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/:examId/complete')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async complete(@Param('examId') examId: string, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'full-exam-complete');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const exam = await this.fullExamService.completeExam(req.currentUser.id, examId, headers);
      return StandardResponse.success(res, exam, 'Full exam completed', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/:examId/results')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async results(@Param('examId') examId: string, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'full-exam-results');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const exam = await this.fullExamService.getResults(req.currentUser.id, examId);
      return StandardResponse.success(res, exam, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/:examId/pause')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async pause(
    @Param('examId') examId: string,
    @Body() body: FullExamRuntimeMutationRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'full-exam-pause');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const exam = await this.fullExamService.pauseExam(req.currentUser.id, examId, body, headers);
      return StandardResponse.success(res, exam, 'Full exam paused', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/:examId/resume')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async resume(
    @Param('examId') examId: string,
    @Body() body: FullExamRuntimeMutationRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'full-exam-resume');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const exam = await this.fullExamService.resumeExam(req.currentUser.id, examId, body, headers);
      return StandardResponse.success(res, exam, 'Full exam resumed', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/:examId/runtime')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async runtime(@Param('examId') examId: string, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'full-exam-runtime');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const runtime = await this.fullExamService.getRuntime(req.currentUser.id, examId);
      return StandardResponse.success(res, runtime, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
