import express, { Application } from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';
import { createServer } from 'http';
import { createExpressServer } from 'routing-controllers';
import trimReqBody from 'trim-request-body';
import xss from 'xss';

import { env } from '@env';
import { Logger } from '../lib/logger';
import { initializeSocketIO } from './SocketIOLoader';
import { telemetryMetricsHandler, telemetryMiddleware } from './telemetryLoader';

const log = new Logger(__filename);

export const expressLoader = () => {
  const expressApp: Application = createExpressServer({
    cors: {
      origin: env.app.corsOrigin === '*' ? true : env.app.corsOrigin
    },
    classTransformer: true,
    routePrefix: env.app.routePrefix,
    defaultErrorHandler: false,
    controllers: env.app.dirs.controllers,
    middlewares: env.app.dirs.middlewares,
    interceptors: env.app.dirs.interceptors
  });

  const telemetryConfig = env.telemetry || { enabled: false, metricsEnabled: false, metricsPath: '/metrics' };
  const stripeWebhookPath = `${env.app.routePrefix}/subscription/webhook`;

  const captureRawBody = (req: express.Request, _res: express.Response, buffer: Buffer) => {
    if (req.originalUrl?.startsWith(stripeWebhookPath)) {
      req.rawBody = Buffer.from(buffer);
    }
  };

  expressApp.use(
    express.json({
      limit: '2mb',
      verify: captureRawBody
    })
  );

  expressApp.use(
    express.urlencoded({
      extended: true,
      limit: '2mb',
      verify: captureRawBody
    })
  );

  // Security middleware - applied in order of importance

  // 1. Helmet for security headers - must be applied BEFORE routing-controllers
  // Skip helmet if response already sent (prevents "Cannot set headers" errors)
  expressApp.use((req, res, next) => {
    if (res.headersSent) {
      return next();
    }

    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:']
        }
      },
      crossOriginEmbedderPolicy: false
    })(req, res, next);
  });

  // 2. XSS protection using xss package for request sanitization
  expressApp.use((req, res, next) => {
    if (req.originalUrl?.startsWith(stripeWebhookPath)) {
      return next();
    }

    if (req.body && typeof req.body === 'object') {
      req.body = JSON.parse(xss(JSON.stringify(req.body)));
    }
    if (req.query && typeof req.query === 'object') {
      Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
          req.query[key] = xss(req.query[key] as string);
        }
      });
    }
    if (req.params && typeof req.params === 'object') {
      Object.keys(req.params).forEach(key => {
        if (typeof req.params[key] === 'string') {
          req.params[key] = xss(req.params[key] as string);
        }
      });
    }
    next();
  });

  // 3. MongoDB injection protection
  const sanitizeMiddleware = mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ key }) => {
      console.warn(`Request sanitized for key: ${key}`);
    }
  });

  expressApp.use((req, res, next) => {
    if (req.originalUrl?.startsWith(stripeWebhookPath)) {
      return next();
    }
    return sanitizeMiddleware(req, res, next);
  });

  // 4. HTTP Parameter Pollution protection
  expressApp.use(
    hpp({
      whitelist: ['tags', 'categories'] // Allow arrays for specific parameters
    })
  );

  // 5. Trim request body whitespace
  const trimMiddleware = trimReqBody as unknown as express.RequestHandler;
  expressApp.use((req, res, next) => {
    if (req.originalUrl?.startsWith(stripeWebhookPath)) {
      return next();
    }
    return trimMiddleware(req, res, next);
  });

  // 6. Telemetry instrumentation and metrics exposure
  expressApp.use(telemetryMiddleware);

  if (telemetryConfig.metricsEnabled) {
    expressApp.get(telemetryConfig.metricsPath, telemetryMetricsHandler);
  }

  // Rate limiting - disabled in development to avoid IP detection issues
  if (env.isProduction) {
    const limiter = rateLimit({
      windowMs: env.app.rateWindowMs,
      max: env.app.rateMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: 'Too many requests from this IP, please try again later.'
      }
    });
    expressApp.use(limiter);
  }

  if (!env.isTest) {
    // Create HTTP server
    const httpServer = createServer(expressApp);

    // Initialize Socket.io
    initializeSocketIO(httpServer);

    // Start listening
    httpServer.listen(env.app.port, () => {
      log.info(`🚀 Server listening on port ${env.app.port} with Socket.io enabled`);
    });
  }

  return expressApp;
};
expressLoader();
