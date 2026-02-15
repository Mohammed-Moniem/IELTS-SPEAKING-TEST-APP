import * as express from 'express';
import { StatusCodes } from 'http-status-codes';
import { ExpressErrorMiddlewareInterface, HttpError, Middleware } from 'routing-controllers';
import { Service } from 'typedi';

import { URC_HEADER_LOWERCASE } from '@api/constants/headers';
import { env } from '@env';
import { ErrorResponse } from '@errors/ErrorResponse';
import { CODES } from '@errors/errorCodeConstants';
import { Logger } from '@lib/logger';

@Service()
@Middleware({ type: 'after' })
export class ErrorHandlerMiddleware implements ExpressErrorMiddlewareInterface {
  public isProduction = env.isProduction;
  private log = new Logger(__filename);

  constructor() {}

  public error(error: HttpError, req: express.Request, res: express.Response, next: express.NextFunction): void {
    const requestId = (req.headers[URC_HEADER_LOWERCASE] as string) || undefined;
    const logMessage = `ErrorHandleMiddleware, error, urc: ${requestId}`;
    this.log.error(`${logMessage}, method ${req.method}, url ${req.url}`, error);

    if (res.headersSent || res.writableEnded) {
      return next(error);
    }

    const errors = new ErrorResponse(error).get();
    const status = error?.httpCode || StatusCodes.INTERNAL_SERVER_ERROR;

    const first = (errors && errors.length ? errors[0] : undefined) as any | undefined;
    const code = first?.code || (error as any)?.code || CODES.GenericErrorMessage;
    const message = first?.message || (error as any)?.message || env.errors.default.errorMessage;
    const description = first?.description || (error as any)?.description || env.errors.default.errorDescription;

    res.status(status).json({
      status,
      success: false,
      error: {
        code,
        message,
        description,
        details: errors
      },
      timestamp: new Date().toISOString(),
      requestId
    });
  }
}
