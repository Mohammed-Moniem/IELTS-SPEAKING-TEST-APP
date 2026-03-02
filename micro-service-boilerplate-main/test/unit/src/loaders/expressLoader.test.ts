import { createServer } from 'http';
import { useExpressServer } from 'routing-controllers';

import { env } from '../../../../src/env';
import { initializeSocketIO } from '../../../../src/loaders/SocketIOLoader';

jest.mock('../../../../src/env', () => ({
  env: {
    app: {
      corsOrigin: '*',
      routePrefix: '/api/v1',
      port: 3000,
      rateWindowMs: 60000,
      rateMax: 60,
      dirs: {
        controllers: [],
        middlewares: [],
        interceptors: []
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

jest.mock('../../../../src/loaders/telemetryLoader', () => ({
  telemetryMiddleware: (_req: any, _res: any, next: any) => next(),
  telemetryMetricsHandler: jest.fn()
}));

jest.mock('../../../../src/loaders/SocketIOLoader', () => ({
  initializeSocketIO: jest.fn()
}));

jest.mock('routing-controllers', () => ({
  useExpressServer: jest.fn()
}));

jest.mock('http', () => ({
  createServer: jest.fn()
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
  (app.post as jest.Mock).mockReset();
  (app.put as jest.Mock).mockReset();
  (app.delete as jest.Mock).mockReset();
  (app.patch as jest.Mock).mockReset();
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
  xssMock.mockImplementation((value: any) => value);

  const createServerMock = createServer as jest.Mock;
  createServerMock.mockReset();
  createServerMock.mockImplementation(() => ({
    listen: jest.fn((_port: number, cb?: () => void) => {
      cb?.();
    })
  }));
};

const loadExpressLoader = () => {
  let loaded: any;
  jest.isolateModules(() => {
    loaded = require('../../../../src/loaders/expressLoader');
  });
  return loaded as { expressLoader: () => any };
};

describe('expressLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (env as any).isTest = true;
    (env as any).isProduction = false;
    (env as any).app.corsOrigin = '*';
    (env as any).app.routePrefix = '/api/v1';
    (env as any).app.port = 3000;
    configureModuleMocks();
  });

  it('wires routing-controllers with expected options', () => {
    loadExpressLoader();

    const useExpressServerMock = useExpressServer as jest.Mock;
    expect(useExpressServerMock).toHaveBeenCalledTimes(1);
    expect(useExpressServerMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        routePrefix: env.app.routePrefix,
        classTransformer: true,
        defaultErrorHandler: false,
        controllers: env.app.dirs.controllers,
        middlewares: env.app.dirs.middlewares,
        interceptors: env.app.dirs.interceptors,
        cors: { origin: true }
      })
    );
  });

  it('does not start HTTP server in test mode', () => {
    (env as any).isTest = true;
    loadExpressLoader();

    expect(createServer).not.toHaveBeenCalled();
    expect(initializeSocketIO).not.toHaveBeenCalled();
  });

  it('starts HTTP server and Socket.IO when not in test mode', () => {
    (env as any).isTest = false;
    const { expressLoader } = loadExpressLoader();

    const createServerMock = createServer as jest.Mock;
    createServerMock.mockClear();
    (initializeSocketIO as jest.Mock).mockClear();

    expressLoader();

    expect(createServerMock).toHaveBeenCalledTimes(1);
    const httpServer = createServerMock.mock.results[0].value;
    expect(initializeSocketIO).toHaveBeenCalledWith(httpServer);
    expect(httpServer.listen).toHaveBeenCalledWith(env.app.port, expect.any(Function));
  });
});
