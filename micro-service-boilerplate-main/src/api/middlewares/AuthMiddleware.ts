import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { verifyAccessToken } from '@lib/auth/token';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import * as express from 'express';
import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers';
import { Service } from 'typedi';

@Service()
@Middleware({ type: 'before' })
export class AuthMiddleware implements ExpressMiddlewareInterface {
  private log = new Logger(__filename);

  private readonly PUBLIC_PATHS = ['/auth/register', '/auth/login', '/auth/refresh', '/health'];

  public use(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const headers: IRequestHeaders = { urc: (req.header('Unique-Reference-Code') || '').trim() || 'auth-mw' };
    const logMessage = constructLogMessage(__filename, 'use', headers);

    // Skip authentication for public endpoints
    const isPublicPath = this.PUBLIC_PATHS.some(path => req.path.endsWith(path));
    if (isPublicPath) {
      this.log.debug(`${logMessage} :: Skipping auth for public path: ${req.path}`);
      return next();
    }

    const authorization = req.header('Authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new CSError(HTTP_STATUS_CODES.UNAUTHORIZED, CODES.NotAuthorized, 'Missing bearer token');
    }

    try {
      const token = authorization.replace('Bearer ', '').trim();
      const payload = verifyAccessToken(token);
      req.currentUser = {
        id: payload.sub,
        email: payload.email,
        plan: payload.plan
      };

      if (!req.header('Unique-Reference-Code')) {
        res.setHeader('Unique-Reference-Code', payload.sub);
      }

      this.log.debug(`${logMessage} :: Authenticated request for user ${payload.sub}`);
      next();
    } catch (error) {
      this.log.error(`${logMessage} :: Failed to authenticate request`, { error });
      throw new CSError(HTTP_STATUS_CODES.UNAUTHORIZED, CODES.NotAuthorized, 'Invalid or expired token');
    }
  }
}
