import express from 'express';
import { env } from '../../../../src/env';
import { homeLoader } from '../../../../src/loaders/homeLoader';

// Mocking express module
jest.mock('express', () => {
  const mockGet = jest.fn();
  const mockUse = jest.fn();
  return jest.fn().mockImplementation(() => ({
    get: mockGet,
    use: mockUse,
    listen: jest.fn()
  }));
});

// Mocking environment configuration consistently
jest.mock('../../../../src/env', () => ({
  env: {
    app: {
      routePrefix: '/notifications-service',
      name: 'Test Application',
      version: '1.0.0',
      description: 'A test application'
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

describe('homeLoader', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('should create an express app and set up a GET route', () => {
    const mockGet = jest.fn();
    (express as unknown as jest.Mock).mockImplementation(() => ({
      get: mockGet
    }));

    homeLoader();

    expect(express).toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith(env.app.routePrefix, expect.any(Function));
  });

  it('should respond with the app name, version, and description', () => {
    const mockJson = jest.fn();
    const mockGet = jest.fn((route, handler) => {
      handler({}, { json: mockJson });
    });
    (express as unknown as jest.Mock).mockImplementation(() => ({
      get: mockGet
    }));

    homeLoader();

    expect(mockJson).toHaveBeenCalledWith({
      name: env.app.name,
      version: env.app.version,
      description: env.app.description
    });
  });
});
