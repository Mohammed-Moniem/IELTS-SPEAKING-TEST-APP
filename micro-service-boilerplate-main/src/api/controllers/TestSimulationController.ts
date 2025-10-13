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
import { CompleteTestSimulationRequest, TestSimulationParam, TestSimulationQuery } from '@dto/TestSimulationDto';
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
}
