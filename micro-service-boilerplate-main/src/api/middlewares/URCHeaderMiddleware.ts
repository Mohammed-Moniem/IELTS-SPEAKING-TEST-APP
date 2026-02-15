import * as express from 'express';
import { ExpressMiddlewareInterface } from 'routing-controllers';
import { Container } from 'typedi';

import { URC_HEADER } from '@api/constants/headers';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { constructLogMessage, isEmptyOrNull } from '@lib/env/helpers';
import { Logger } from '@lib/logger/Logger';
import { Service } from 'typedi';

@Service()
// @Middleware({ type: 'before' })
export class URCHeaderMiddleware implements ExpressMiddlewareInterface {
  private log = new Logger(__filename);

  public use(req: express.Request, res: express.Response, next: express.NextFunction): any {
    const headers = { urc: req.header(URC_HEADER) || 'unknown' };
    const logMessage = constructLogMessage(__filename, 'use', headers as any);
    this.log.info(logMessage);

    const urc = (req.header(URC_HEADER) || '').trim();
    if (isEmptyOrNull(urc)) {
      this.log.warn('Missing or empty Unique-Reference-Code header in request');
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.EmptyURC);
    }

    this.log.debug(`Setting Unique-Reference-Code header in response: ${urc}`);
    res.setHeader(URC_HEADER, urc);

    Container.set('requestHeaders', req.headers);
    this.log.debug('Request headers stored in container for downstream usage');
    next();
  }
}
