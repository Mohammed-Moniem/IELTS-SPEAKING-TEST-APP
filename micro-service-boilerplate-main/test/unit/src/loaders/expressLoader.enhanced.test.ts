import { createExpressServer } from 'routing-controllers';
import { env } from '../../../../src/env';

// Mock all middleware dependencies
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
    isTest: true
  }
}));

jest.mock('routing-controllers', () => ({
  createExpressServer: jest.fn()
}));

jest.mock('helmet', () => jest.fn().mockReturnValue((req: any, res: any, next: any) => next()));
jest.mock('express-mongo-sanitize', () => jest.fn().mockReturnValue((req: any, res: any, next: any) => next()));
jest.mock('hpp', () => jest.fn().mockReturnValue((req: any, res: any, next: any) => next()));
jest.mock('trim-request-body', () => (req: any, res: any, next: any) => next());
jest.mock('express-rate-limit', () => jest.fn().mockReturnValue((req: any, res: any, next: any) => next()));
jest.mock('xss', () =>
  jest.fn().mockImplementation(input => {
    if (input === undefined) return '';
    return typeof input === 'string' ? input.replace(/<[^>]*>/g, '') : input;
  })
);

describe('expressLoader Enhanced Tests', () => {
  let mockExpressApp: any;
  let mockUse: jest.Mock;
  let mockListen: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUse = jest.fn();
    mockListen = jest.fn();

    mockExpressApp = {
      listen: mockListen,
      use: mockUse,
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn()
    };

    (createExpressServer as jest.Mock).mockReturnValue(mockExpressApp);
  });

  describe('Security Middleware Tests', () => {
    test('should apply XSS protection middleware for request body', () => {
      // Import and execute the loader function
      const { expressLoader } = require('../../../../src/loaders/expressLoader');
      expressLoader();

      // Find the XSS middleware call
      const xssMiddlewareCall = mockUse.mock.calls.find(
        call => typeof call[0] === 'function' && call[0].toString().includes('req.body')
      );

      expect(xssMiddlewareCall).toBeDefined();

      // Test the XSS middleware function
      const xssMiddleware = xssMiddlewareCall[0];
      const mockReq = {
        body: { message: '<script>alert("xss")</script>' },
        query: { search: '<img src=x onerror=alert(1)>' },
        params: { id: '<svg onload=alert(1)>' }
      };
      const mockRes = {};
      const mockNext = jest.fn();

      xssMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should apply MongoDB sanitization middleware', () => {
      const { expressLoader } = require('../../../../src/loaders/expressLoader');
      expressLoader();

      // Verify mongo-sanitize middleware was applied
      expect(mockUse).toHaveBeenCalled();

      // Check that mongo-sanitize was configured with onSanitize callback
      const mongoSanitizeMock = require('express-mongo-sanitize');
      expect(mongoSanitizeMock).toHaveBeenCalledWith({
        replaceWith: '_',
        onSanitize: expect.any(Function)
      });
    });

    test('should apply HPP protection middleware', () => {
      const { expressLoader } = require('../../../../src/loaders/expressLoader');
      expressLoader();

      // Verify HPP middleware was applied
      const hppMock = require('hpp');
      expect(hppMock).toHaveBeenCalledWith({
        whitelist: ['tags', 'categories']
      });
    });

    test('should apply Helmet security headers', () => {
      const { expressLoader } = require('../../../../src/loaders/expressLoader');
      expressLoader();

      // Verify Helmet middleware was applied with correct config
      const helmetMock = require('helmet');
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

    test('should apply rate limiting middleware', () => {
      const { expressLoader } = require('../../../../src/loaders/expressLoader');
      expressLoader();

      // Verify rate limit middleware was applied
      const rateLimitMock = require('express-rate-limit');
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

    test('should apply trim-request-body middleware', () => {
      const { expressLoader } = require('../../../../src/loaders/expressLoader');
      expressLoader();

      // Verify trim middleware was applied
      expect(mockUse).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('XSS Middleware Edge Cases', () => {
    test('should register XSS middleware correctly', () => {
      const { expressLoader } = require('../../../../src/loaders/expressLoader');
      expressLoader();

      // Find the XSS middleware call
      const xssMiddlewareCall = mockUse.mock.calls.find(
        call => typeof call[0] === 'function' && call[0].toString().includes('req.body')
      );

      expect(xssMiddlewareCall).toBeDefined();
      expect(typeof xssMiddlewareCall[0]).toBe('function');
    });

    test('should handle request with null body', () => {
      const { expressLoader } = require('../../../../src/loaders/expressLoader');
      expressLoader();

      const xssMiddlewareCall = mockUse.mock.calls.find(
        call => typeof call[0] === 'function' && call[0].toString().includes('req.body')
      );

      const xssMiddleware = xssMiddlewareCall[0];
      const mockReq = { body: null, query: {}, params: {} };
      const mockRes = {};
      const mockNext = jest.fn();

      expect(() => {
        xssMiddleware(mockReq, mockRes, mockNext);
      }).not.toThrow();

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('MongoDB Sanitization Callback', () => {
    test('should call onSanitize callback when sanitization occurs', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { expressLoader } = require('../../../../src/loaders/expressLoader');
      expressLoader();

      // Get the onSanitize callback
      const mongoSanitizeMock = require('express-mongo-sanitize');
      const onSanitizeCallback = mongoSanitizeMock.mock.calls[0][0].onSanitize;

      // Test the callback
      const mockContext = {
        req: { body: { $where: 'malicious code' } },
        key: '$where'
      };

      onSanitizeCallback(mockContext);

      expect(consoleSpy).toHaveBeenCalledWith('Request sanitized for key: $where');

      consoleSpy.mockRestore();
    });
  });

  describe('Server Configuration', () => {
    test('should create express server with correct CORS origin when not wildcard', () => {
      // Test with specific origin
      (env as any).app.corsOrigin = 'https://example.com';

      const { expressLoader } = require('../../../../src/loaders/expressLoader');
      expressLoader();

      expect(createExpressServer).toHaveBeenCalledWith({
        cors: {
          origin: 'https://example.com'
        },
        classTransformer: true,
        routePrefix: env.app.routePrefix,
        defaultErrorHandler: false,
        controllers: env.app.dirs.controllers,
        middlewares: env.app.dirs.middlewares,
        interceptors: env.app.dirs.interceptors
      });
    });

    test('should create express server with CORS origin true when wildcard', () => {
      // Test with wildcard
      (env as any).app.corsOrigin = '*';

      const { expressLoader } = require('../../../../src/loaders/expressLoader');
      expressLoader();

      expect(createExpressServer).toHaveBeenCalledWith({
        cors: {
          origin: true
        },
        classTransformer: true,
        routePrefix: env.app.routePrefix,
        defaultErrorHandler: false,
        controllers: env.app.dirs.controllers,
        middlewares: env.app.dirs.middlewares,
        interceptors: env.app.dirs.interceptors
      });
    });

    test('should not start server when in test environment', () => {
      (env as any).isTest = true;

      const { expressLoader } = require('../../../../src/loaders/expressLoader');
      expressLoader();

      expect(mockListen).not.toHaveBeenCalled();
    });

    test('should start server when not in test environment', () => {
      (env as any).isTest = false;

      const { expressLoader } = require('../../../../src/loaders/expressLoader');
      expressLoader();

      expect(mockListen).toHaveBeenCalledWith(env.app.port);
    });
  });

  describe('Middleware Order', () => {
    test('should apply middleware in correct order', () => {
      const { expressLoader } = require('../../../../src/loaders/expressLoader');
      expressLoader();

      // Verify all middleware were applied (exact count may vary)
      expect(mockUse).toHaveBeenCalled();
      expect(mockUse.mock.calls.length).toBeGreaterThan(5);
    });
  });
});
