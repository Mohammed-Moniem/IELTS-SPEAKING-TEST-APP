import express, { Application } from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';
import { createServer } from 'http';
import { useExpressServer } from 'routing-controllers';
import trimReqBody from 'trim-request-body';
import xss from 'xss';

import { env } from '@env';
import { Logger } from '../lib/logger';
import { referralService } from '@services/ReferralService';
import { initializeSocketIO } from './SocketIOLoader';
import { telemetryMetricsHandler, telemetryMiddleware } from './telemetryLoader';

type ReferralLandingInfo = Awaited<ReturnType<typeof referralService.getReferralLandingInfo>>;

const log = new Logger(__filename);

export const expressLoader = () => {
  const expressApp: Application = express();

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

  const deepLinkScheme = env.referral?.deepLinkScheme || 'ieltsspeaking';
  const appStoreUrl = env.referral?.iosStoreUrl || 'https://apps.apple.com/';
  const playStoreUrl = env.referral?.androidStoreUrl || 'https://play.google.com/';

  const renderReferralPage = (params: {
    info?: ReferralLandingInfo;
    deepLink?: string;
    error?: string;
  }) => {
    const { info, deepLink, error } = params;
    const headline = info
      ? `${info.referrer.name} invited you to IELTS Speaking Practice`
      : 'Join IELTS Speaking Practice';
    const description = info
      ? `Use referral code ${info.referralCode} to unlock ${info.rewards.practicePerReferral} free practice session${
          info.rewards.practicePerReferral > 1 ? 's' : ''
        } and start preparing with personalised feedback.`
      : 'The referral link you followed is invalid or has expired. You can still download the app and start practicing today!';

    const bonusBlurb = info
      ? `Both you and ${info.referrer.name} earn bonuses. You get ${info.rewards.refereePoints} points and a free practice session when you register. Refer friends to earn ${info.rewards.referrerPoints} points each and unlock a bonus simulation after ${info.rewards.simulationThreshold} invites.`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${headline}</title>
    <style>
      * {
        box-sizing: border-box;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      body {
        margin: 0;
        padding: 0;
        background: linear-gradient(135deg, #1e40af, #1e3a8a);
        min-height: 100vh;
        color: #0f172a;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px 16px;
      }
      .card {
        background: #ffffff;
        border-radius: 24px;
        max-width: 520px;
        width: 100%;
        padding: 32px;
        box-shadow: 0 25px 45px rgba(15, 23, 42, 0.18);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        background: rgba(37, 99, 235, 0.12);
        color: #1d4ed8;
        padding: 8px 14px;
        border-radius: 999px;
        margin-bottom: 20px;
      }
      h1 {
        font-size: 28px;
        line-height: 1.3;
        margin: 0 0 16px;
        color: #0f172a;
      }
      p {
        margin: 0 0 16px;
        color: #475569;
        font-size: 16px;
        line-height: 1.6;
      }
      .code-box {
        border: 1px dashed rgba(37, 99, 235, 0.4);
        padding: 20px;
        border-radius: 18px;
        text-align: center;
        background: rgba(37, 99, 235, 0.08);
        margin: 24px 0;
      }
      .code-label {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #1d4ed8;
        margin-bottom: 8px;
      }
      .code-value {
        font-size: 32px;
        letter-spacing: 6px;
        font-weight: 700;
        color: #0f172a;
      }
      .buttons {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin: 24px 0;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 14px 16px;
        border-radius: 14px;
        font-weight: 600;
        font-size: 15px;
        text-decoration: none;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .btn-primary {
        background: #1d4ed8;
        color: #ffffff;
        box-shadow: 0 12px 24px rgba(37, 99, 235, 0.24);
      }
      .btn-secondary {
        background: #f1f5f9;
        color: #1f2937;
        border: 1px solid rgba(148, 163, 184, 0.4);
      }
      .btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 16px 32px rgba(15, 23, 42, 0.12);
      }
      .footer {
        margin-top: 28px;
        font-size: 13px;
        color: #64748b;
      }
      .bonus {
        background: rgba(15, 118, 110, 0.08);
        color: #0f766e;
        border-radius: 14px;
        padding: 14px;
        font-size: 14px;
      }
      @media (max-width: 520px) {
        .card {
          padding: 24px;
        }
        .code-value {
          font-size: 28px;
          letter-spacing: 4px;
        }
        h1 {
          font-size: 24px;
        }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">IELTS Speaking Practice</div>
      <h1>${headline}</h1>
      <p>${description}</p>
      ${info ? `<div class="code-box"><div class="code-label">Referral Code</div><div class="code-value">${info.referralCode}</div></div>` : ''}
      ${info && bonusBlurb ? `<div class="bonus">${bonusBlurb}</div>` : ''}
      <div class="buttons">
        ${deepLink ? `<a class="btn btn-primary" href="${deepLink}">Open in the app</a>` : ''}
        <a class="btn btn-secondary" href="${appStoreUrl}" target="_blank" rel="noopener">Download on the App Store</a>
        <a class="btn btn-secondary" href="${playStoreUrl}" target="_blank" rel="noopener">Get it on Google Play</a>
      </div>
      <div class="footer">
        Having trouble? Copy the referral code and enter it on the registration screen inside the app.
      </div>
      ${error ? `<div class="footer" style="color:#b91c1c; margin-top: 12px;">${error}</div>` : ''}
    </div>
  </body>
</html>`;
  };

  expressApp.get('/referral/:code', async (req, res) => {
    const { code } = req.params;
    try {
      const info = await referralService.getReferralLandingInfo(code);
      if (!info) {
        return res.status(404).send(renderReferralPage({ error: 'Referral link not found or inactive.' }));
      }

      await referralService.trackReferralClick(info.referralCode);
      const deepLink = `${deepLinkScheme}://register?ref=${info.referralCode}`;
      return res.send(renderReferralPage({ info, deepLink }));
    } catch (error) {
      log.error('Failed to render referral landing page', error);
      return res
        .status(500)
        .send(renderReferralPage({ error: 'Something went wrong while loading this referral. Please try again later.' }));
    }
  });

  expressApp.get('/register', (req, res) => {
    const ref = (req.query.ref || req.query.code || '') as string;
    if (ref) {
      return res.redirect(302, `/referral/${String(ref).trim()}`);
    }
    return res.redirect(302, '/');
  });

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

  useExpressServer(
    expressApp,
    ({
      bodyParser: false,
      cors: {
        origin: env.app.corsOrigin === '*' ? true : env.app.corsOrigin
      },
      classTransformer: true,
      routePrefix: env.app.routePrefix,
      defaultErrorHandler: false,
      controllers: env.app.dirs.controllers,
      middlewares: env.app.dirs.middlewares,
      interceptors: env.app.dirs.interceptors,
      currentUserChecker: async (action: any) => {
        return action.request.currentUser;
      },
      authorizationChecker: async (action: any, roles: string[]) => {
        const user = action.request.currentUser;
        if (!user) return false;
        if (roles && roles.length > 0) {
          return roles.includes(user.plan);
        }
        return true;
      }
    } as any)
  );

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
