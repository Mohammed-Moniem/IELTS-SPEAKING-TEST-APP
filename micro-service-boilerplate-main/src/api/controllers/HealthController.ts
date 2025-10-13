import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage, isEmptyOrNull } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { StandardResponse } from '@responses/StandardResponse';
import { Response } from 'express';
import { Get, HeaderParam, HttpCode, JsonController, Res } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { HealthService } from '@services/HealthService';

@JsonController('/health')
export class HealthController {
  private log = new Logger(__filename);

  constructor(private readonly healthService: HealthService) {}

  @Get('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async healthCheck(
    @HeaderParam('Unique-Reference-Code') urc: string,
    @Res() res: Response
  ): Promise<Response | void> {
    const headers: IRequestHeaders = !isEmptyOrNull(urc)
      ? { urc, 'Unique-Reference-Code': urc }
      : buildRequestHeaders(res.req, 'health');
    ensureResponseHeaders(res, headers);
    const logMessage = constructLogMessage(__filename, 'healthCheck', headers);

    this.log.debug(`${logMessage} :: Received health check request`);

    try {
      const healthData = await this.healthService.getHealthStatus(headers);
      this.log.debug(`${logMessage} :: Health check computed successfully`);

      return StandardResponse.success(res, healthData, 'Service health status', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      this.log.error(`${logMessage} :: Health check failed`, { error });
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
