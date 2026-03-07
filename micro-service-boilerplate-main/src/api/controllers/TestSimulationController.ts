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
  UseBefore
} from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import {
  CompleteTestSimulationRequest,
  RuntimeAnswerRequest,
  TestSimulationParam,
  TestSimulationQuery
} from '@dto/TestSimulationDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { aiRateLimiter, sessionStartRateLimiter } from '@middlewares/rateLimitMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { TestSimulationService } from '@services/TestSimulationService';

@JsonController('/test-simulations')
@UseBefore(AuthMiddleware)
export class TestSimulationController {
  constructor(private readonly testSimulationService: TestSimulationService) {}

  @Post('/')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  @UseBefore(sessionStartRateLimiter)
  public async startSimulation(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'simulation-start');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const simulation = await this.testSimulationService.startSimulation(req.currentUser.id, headers);
      return StandardResponse.created(res, simulation, 'Simulation started', headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/:simulationId/complete')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  @UseBefore(aiRateLimiter)
  public async completeSimulation(
    @Params() params: TestSimulationParam,
    @Body() body: CompleteTestSimulationRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'simulation-complete');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const simulation = await this.testSimulationService.completeSimulation(
        req.currentUser.id,
        params.simulationId,
        body.parts,
        headers
      );
      return StandardResponse.success(res, simulation, 'Simulation completed', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listSimulations(@QueryParams() query: TestSimulationQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'simulation-list');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    const options = this.testSimulationService.paginateOptions(query.limit, query.offset);

    try {
      const simulations = await this.testSimulationService.listSimulations(req.currentUser.id, options);
      return StandardResponse.success(res, simulations, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/:simulationId')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getSimulation(@Params() params: TestSimulationParam, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'simulation-detail');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const simulation = await this.testSimulationService.getSimulation(req.currentUser.id, params.simulationId);
      if (!simulation) {
        return StandardResponse.notFound(res, 'Test simulation', headers);
      }

      return StandardResponse.success(res, simulation, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/:simulationId/runtime')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getRuntime(@Params() params: TestSimulationParam, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'simulation-runtime-get');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const runtime = await this.testSimulationService.getRuntime(req.currentUser.id, params.simulationId);
      return StandardResponse.success(res, runtime, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/:simulationId/runtime/advance')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async advanceRuntime(@Params() params: TestSimulationParam, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'simulation-runtime-advance');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const runtime = await this.testSimulationService.advanceRuntime(req.currentUser.id, params.simulationId, headers);
      return StandardResponse.success(res, runtime, 'Simulation runtime advanced', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/:simulationId/runtime/answer')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  @UseBefore(aiRateLimiter)
  public async submitRuntimeAnswer(
    @Params() params: TestSimulationParam,
    @Body() body: RuntimeAnswerRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'simulation-runtime-answer');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const runtime = await this.testSimulationService.submitRuntimeAnswer(
        req.currentUser.id,
        params.simulationId,
        {
          transcript: body.transcript,
          durationSeconds: body.durationSeconds
        },
        headers
      );
      return StandardResponse.success(res, runtime, 'Simulation answer accepted', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/:simulationId/runtime/retry')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async retryRuntimeStep(@Params() params: TestSimulationParam, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'simulation-runtime-retry');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const runtime = await this.testSimulationService.retryRuntimeStep(req.currentUser.id, params.simulationId, headers);
      return StandardResponse.success(res, runtime, 'Simulation runtime retried', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
