import { env } from '../../../../src/env';

jest.mock('../../../../src/env', () => ({
  env: {
    app: {
      corsOrigin: 'https://localhost:3000',
      routePrefix: '/api/v1',
      port: 3000,
      rateWindowMs: 60000,
      rateMax: 60,
      dirs: {
        controllers: ['/controllers/**/*.ts'],
        middlewares: ['/middlewares/**/*.ts'],
        interceptors: ['/interceptors/**/*.ts']
      }
    },
    telemetry: {
      enabled: false,
      metricsEnabled: false,
      metricsPath: '/metrics'
    },
    referral: {
      deepLinkScheme: 'ieltsspeaking',
      iosStoreUrl: 'https://apps.apple.com/',
      androidStoreUrl: 'https://play.google.com/'
    },
    isTest: true,
    isProduction: false
  }
}));

jest.mock('@services/ReferralService', () => ({
  referralService: {
    getReferralLandingInfo: jest.fn().mockResolvedValue(null),
    trackReferralClick: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('../../../../src/loaders/SocketIOLoader', () => ({
  initializeSocketIO: jest.fn()
}));

jest.mock('../../../../src/loaders/telemetryLoader', () => ({
  telemetryMiddleware: (_req: any, _res: any, next: any) => next(),
  telemetryMetricsHandler: jest.fn()
}));

jest.mock('routing-controllers', () => ({
  useExpressServer: jest.fn()
}));

jest.mock('http', () => ({
  createServer: jest.fn(() => ({
    listen: jest.fn()
  }))
}));

jest.mock('helmet', () => jest.fn());
jest.mock('express-mongo-sanitize', () => jest.fn());
jest.mock('hpp', () => jest.fn());
jest.mock('trim-request-body', () => jest.fn());
jest.mock('express-rate-limit', () => jest.fn());
jest.mock('xss', () => jest.fn());

jest.mock('express', () => {
  const app = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn()
  };

  const expressFn: any = jest.fn(() => app);
  expressFn.json = jest.fn();
  expressFn.urlencoded = jest.fn();

  return {
    __esModule: true,
    default: expressFn,
    __app: app
  };
});

const noopMiddleware = (_req: any, _res: any, next: any) => next();

const configureModuleMocks = () => {
  const expressModule = jest.requireMock('express') as any;
  const app = expressModule.__app;
  (app.use as jest.Mock).mockReset();
  (app.get as jest.Mock).mockReset();
  (app.use as jest.Mock).mockImplementation(() => app);

  (expressModule.default as jest.Mock).mockImplementation(() => app);
  (expressModule.default.json as jest.Mock).mockImplementation(() => noopMiddleware);
  (expressModule.default.urlencoded as jest.Mock).mockImplementation(() => noopMiddleware);

  const helmetMock = jest.requireMock('helmet') as jest.Mock;
  const mongoSanitizeMock = jest.requireMock('express-mongo-sanitize') as jest.Mock;
  const hppMock = jest.requireMock('hpp') as jest.Mock;
  const trimReqBodyMock = jest.requireMock('trim-request-body') as jest.Mock;
  const rateLimitMock = jest.requireMock('express-rate-limit') as jest.Mock;
  const xssMock = jest.requireMock('xss') as jest.Mock;

  helmetMock.mockImplementation(() => noopMiddleware);
  mongoSanitizeMock.mockImplementation(() => noopMiddleware);
  hppMock.mockImplementation(() => noopMiddleware);
  trimReqBodyMock.mockImplementation(() => noopMiddleware);
  rateLimitMock.mockImplementation(() => noopMiddleware);
  xssMock.mockImplementation((input: any) => (typeof input === 'string' ? input.replace(/<[^>]*>/g, '') : input));
};

const loadExpressLoader = () => {
  jest.isolateModules(() => {
    require('../../../../src/loaders/expressLoader');
  });

  const expressModule = jest.requireMock('express') as any;
  return expressModule.__app;
};

describe('expressLoader Enhanced Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (env as any).isTest = true;
    (env as any).isProduction = false;
    (env as any).app.corsOrigin = 'https://localhost:3000';
    configureModuleMocks();
  });

  test('registers XSS middleware and sanitizes request body/query/params', () => {
    const app = loadExpressLoader();

    const xssMiddlewareCall = (app.use as jest.Mock).mock.calls.find(
      (call: any[]) => typeof call[0] === 'function' && call[0].toString().includes('req.body')
    );

    expect(xssMiddlewareCall).toBeDefined();

    const xssMiddleware = xssMiddlewareCall[0];
    const req: any = {
      originalUrl: '/api/v1/writing/submissions',
      body: { message: '<script>alert("xss")</script>' },
      query: { q: '<img src=x onerror=alert(1)>' },
      params: { id: '<svg onload=alert(1)>' }
    };
    const next = jest.fn();

    xssMiddleware(req, {}, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.message).not.toContain('<script>');
    expect(req.query.q).not.toContain('<img');
    expect(req.params.id).not.toContain('<svg');
  });

  test('configures mongo sanitize and exposes sanitize callback behavior', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    loadExpressLoader();

    const mongoSanitizeMock = jest.requireMock('express-mongo-sanitize') as jest.Mock;
    expect(mongoSanitizeMock).toHaveBeenCalledWith({
      replaceWith: '_',
      onSanitize: expect.any(Function)
    });

    const sanitizeConfig = mongoSanitizeMock.mock.calls[0][0];
    sanitizeConfig.onSanitize({ key: '$where' });
    expect(warnSpy).toHaveBeenCalledWith('Request sanitized for key: $where');

    warnSpy.mockRestore();
  });

  test('applies HPP and Helmet with expected configuration', () => {
    loadExpressLoader();

    const expressModule = jest.requireMock('express') as any;
    const app = expressModule.__app;
    const hppMock = jest.requireMock('hpp') as jest.Mock;
    const helmetMock = jest.requireMock('helmet') as jest.Mock;

    const helmetWrapperCall = (app.use as jest.Mock).mock.calls.find(
      (call: any[]) => typeof call[0] === 'function' && call[0].toString().includes('headersSent')
    );
    expect(helmetWrapperCall).toBeDefined();

    const helmetWrapper = helmetWrapperCall[0];
    const next = jest.fn();
    helmetWrapper({ originalUrl: '/api/v1/writing/submissions' }, { headersSent: false }, next);

    expect(hppMock).toHaveBeenCalledWith({
      whitelist: ['tags', 'categories']
    });

    expect(helmetMock).toHaveBeenCalledWith({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:']
        }
      },
      crossOriginEmbedderPolicy: false
    });
  });

  test('enables rate limiter only in production', () => {
    const rateLimitMock = jest.requireMock('express-rate-limit') as jest.Mock;

    (env as any).isProduction = false;
    loadExpressLoader();
    expect(rateLimitMock).not.toHaveBeenCalled();

    jest.clearAllMocks();
    configureModuleMocks();
    (env as any).isProduction = true;
    loadExpressLoader();

    expect(rateLimitMock).toHaveBeenCalledWith({
      windowMs: env.app.rateWindowMs,
      max: env.app.rateMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: 'Too many requests from this IP, please try again later.'
      }
    });
  });
});
