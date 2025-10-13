import * as express from 'express';
import { StatusCodes } from 'http-status-codes';
import { ExpressErrorMiddlewareInterface, HttpError, Middleware } from 'routing-controllers';
import { Service } from 'typedi';

import { env } from '@env';
import { ErrorResponse } from '@errors/ErrorResponse';
import { Logger } from '@lib/logger';

@Service()
@Middleware({ type: 'after' })
export class ErrorHandlerMiddleware implements ExpressErrorMiddlewareInterface {
  public isProduction = env.isProduction;
  private log = new Logger(__filename);

  constructor() {}

  public error(error: HttpError, req: express.Request, res: express.Response, next: express.NextFunction): void {
    const requestId = (req.headers['unique-reference-code'] as string) || undefined;
    const logMessage = `ErrorHandleMiddleware, error, urc: ${requestId}`;
    this.log.error(`${logMessage}, method ${req.method}, url ${req.url}`, error);

    if (res.headersSent || res.writableEnded) {
      return next(error);
    }

    const errors = new ErrorResponse(error).get();
    const status = error?.httpCode || StatusCodes.INTERNAL_SERVER_ERROR;

    res.status(status).json({ errors });
  }
}
