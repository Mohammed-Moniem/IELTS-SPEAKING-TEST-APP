import { AUTHORIZATION_HEADER, URC_HEADER } from '@api/constants/headers';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { getCurrentUserFromAccessToken } from '@lib/supabaseAuth';
import { randomUUID } from 'crypto';
import * as express from 'express';
import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers';
import { Service } from 'typedi';

@Service()
@Middleware({ type: 'before' })
export class AuthMiddleware implements ExpressMiddlewareInterface {
  private log = new Logger(__filename);

  private readonly PUBLIC_PATHS = [
    '/auth/register',
    '/auth/login',
    '/auth/refresh',
    '/auth/guest-session',
    '/auth/password-reset/request',
    '/auth/password-reset/confirm',
    '/health',
    '/ppt'
  ];

  public use(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const headers: IRequestHeaders = { urc: (req.header(URC_HEADER) || '').trim() || 'auth-mw' };
    const logMessage = constructLogMessage(__filename, 'use', headers);

    // Skip authentication for public endpoints
    // - exact endpoints still work via `endsWith`
    // - prefix endpoints (like `/ppt/*`) work via `includes("/ppt/")`
    const isPublicPath = this.PUBLIC_PATHS.some(path => req.path.endsWith(path) || req.path.includes(`${path}/`));
    if (isPublicPath) {
      this.log.debug(`${logMessage} :: Skipping auth for public path: ${req.path}`);
      return next();
    }

    const authorization = req.header(AUTHORIZATION_HEADER);
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new CSError(HTTP_STATUS_CODES.UNAUTHORIZED, CODES.NotAuthorized, 'Missing bearer token');
    }

    const token = authorization.replace('Bearer ', '').trim();

    getCurrentUserFromAccessToken(token)
      .then(currentUser => {
        req.currentUser = {
          id: currentUser.id,
          email: currentUser.email,
          plan: currentUser.plan,
          scope: currentUser.scope
        };

        const existingUrc = (req.header(URC_HEADER) || '').trim();
        if (existingUrc) {
          res.setHeader(URC_HEADER, existingUrc);
        } else {
          res.setHeader(URC_HEADER, randomUUID());
        }

        this.log.debug(`${logMessage} :: Authenticated request for user ${currentUser.id}`);
        next();
      })
      .catch(error => {
        this.log.error(`${logMessage} :: Failed to authenticate request`, { error });
        next(new CSError(HTTP_STATUS_CODES.UNAUTHORIZED, CODES.NotAuthorized, 'Invalid or expired token'));
      });
  }
}
