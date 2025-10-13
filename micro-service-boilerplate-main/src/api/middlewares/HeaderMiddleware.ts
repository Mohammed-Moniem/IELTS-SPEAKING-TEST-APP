import * as express from 'express';
import { ExpressMiddlewareInterface } from 'routing-controllers';
import { Container } from 'typedi';

import { Error } from '@errors/Error';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { Service } from 'typedi';

@Service()
export class HeaderMiddleware implements ExpressMiddlewareInterface {
  public use(req: express.Request, res: express.Response, next: express.NextFunction): any {
    const authorizeHeader = (req.header('Authorization') || '').trim();
    if (!authorizeHeader) {
      throw new Error(HTTP_STATUS_CODES.BAD_REQUEST, CODES.EmptyAuthorization);
    }
    if (authorizeHeader.indexOf('Bearer') < 0) {
      throw new Error(HTTP_STATUS_CODES.BAD_REQUEST, CODES.NotAuthorized);
    }

    const urc = (req.header('Unique-Reference-Code') || '').trim();
    if (!urc) {
      throw new Error(HTTP_STATUS_CODES.BAD_REQUEST, CODES.EmptyURC);
    }
    res.setHeader('Unique-Reference-Code', urc);

    Container.set('requestHeaders', req.headers);
    next();
  }
}
