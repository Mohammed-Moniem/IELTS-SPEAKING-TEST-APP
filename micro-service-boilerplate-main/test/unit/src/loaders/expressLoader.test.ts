import { createExpressServer } from 'routing-controllers';
import { env } from '../../../../src/env';
import { expressLoader } from '../../../../src/loaders/expressLoader';

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
    isTest: true
  }
}));

jest.mock('routing-controllers', () => ({
  createExpressServer: jest.fn().mockReturnValue({
    listen: jest.fn(),
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn()
  })
}));

jest.mock('cors', () => jest.fn().mockReturnValue((req: any, res: any, next: any) => next()));
jest.mock('express-rate-limit', () => jest.fn().mockReturnValue((req: any, res: any, next: any) => next()));

describe('expressLoader', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create an express server', () => {
    // Ensure mock returns proper express app object
    const mockExpressApp = {
      listen: jest.fn(),
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn()
    };
    (createExpressServer as jest.Mock).mockReturnValue(mockExpressApp);

    expressLoader();

    expect(createExpressServer).toHaveBeenCalledWith({
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
  });

  it('should start listening on the specified port if not in test environment', () => {
    env.isTest = false;
    const mockListen = jest.fn();
    const mockUse = jest.fn();
    (createExpressServer as jest.Mock).mockReturnValue({
      listen: mockListen,
      use: mockUse
    });

    expressLoader();

    expect(mockListen).toHaveBeenCalledWith(env.app.port);
  });

  it('should not start listening if in test environment', () => {
    env.isTest = true;
    const mockListen = jest.fn();
    const mockUse = jest.fn();
    (createExpressServer as jest.Mock).mockReturnValue({
      listen: mockListen,
      use: mockUse
    });

    expressLoader();

    expect(mockListen).not.toHaveBeenCalled();
  });
});
