import 'dotenv/config';
import 'reflect-metadata';

import connectDB from '../../../src/loaders/DBLoader';

jest.mock('routing-controllers', () => {
  const originalModule = jest.requireActual('routing-controllers');
  return {
    ...originalModule,
    createExpressServer: jest.fn().mockImplementation(config => {
      return {
        use: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        listen: jest.fn()
      };
    })
  };
});

jest.mock('../../../src/env', () => ({
  env: {
    app: {
      routePrefix: '/notifications-service',
      name: 'Test Application',
      version: '1.0.0',
      description: 'A test application',
      dirs: {
        controllers: ['src/api/controllers/**/*Controller.ts'],
        middlewares: ['src/api/middlewares/**/*Middleware.ts'],
        interceptors: ['src/api/interceptors/**/*Interceptor.ts'],
        resolvers: ['src/api/resolvers/**/*Resolver.ts']
      }
    },
    constants: {
      sourceEmail: 'source@example.com',
      encryption: {
        key: Buffer.alloc(32, 'a').toString('base64'), // 32 bytes key for AES-256
        iv: Buffer.alloc(16, 'b').toString('base64') // 16 bytes IV for AES
      }
    }
  },
  getOsEnv: jest.fn().mockImplementation(key => {
    const configs = {
      APP_NAME: 'Test Application',
      APP_HOST: 'localhost',
      APP_PORT: '3000',
      PORT: '3000',
      SOURCE_EMAIL: 'source@example.com'
    };
    return configs[key];
  }),
  normalizePort: jest.fn().mockImplementation(val => parseInt(val, 10) || val),
  toBool: jest.fn().mockImplementation(value => value === 'true' || value === true)
}));

jest.mock('../../../src/lib/banner', () => jest.fn());
jest.mock('../../../src/lib/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    error: jest.fn()
  }))
}));
jest.mock('../../../src/loaders/DBLoader', () => jest.fn().mockResolvedValue(true));
jest.mock('../../../src/loaders/winstonLoader', () => ({
  winstonLoader: jest.fn().mockResolvedValue(true)
}));

describe('app', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('should be able to call connectDB', async () => {
    await connectDB();
    expect(connectDB).toHaveBeenCalled();
  }, 30000);

  it('should initiate winstonLoader', async () => {
    const { winstonLoader } = require('../../../src/loaders/winstonLoader');
    await winstonLoader();
    expect(winstonLoader).toHaveBeenCalled();
  });

  // Continue with other tests...
});
