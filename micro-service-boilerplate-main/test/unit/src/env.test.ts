import * as dotenv from 'dotenv';
import * as path from 'path';

// Mock dotenv with proper function tracking
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/'))
}));

// Import after mocks are set up
import { env } from '../../../src/env';

describe('env', () => {
  beforeAll(() => {
    // Setup mock environment variables before all tests
    process.env = {
      NODE_ENV: 'test',
      APP_NAME: 'service',
      APP_VERSION: '1.0.0',
      APP_DESCRIPTION: 'NodeJS TypeScript Express Server',
      APP_HOST: 'localhost',
      APP_SCHEMA: 'http',
      APP_ROUTE_PREFIX: '/service/api',
      PORT: '3002',
      APP_BANNER: 'true',
      LOG_LEVEL: 'info',
      LOG_JSON: 'false',
      LOG_OUTPUT: 'stdout',
      MONGO_URL: 'mongodb://127.0.0.1:27017/ServiceDB',
      MONITOR_ENABLED: 'false',
      MONITOR_ROUTE: '/status',
      MONITOR_USERNAME: 'admin',
      MONITOR_PASSWORD: 'admin',
      ERROR_CODE_PREFIX: 'SERVICE',
      DEFAULT_ERROR_CODE: 'GLOBAL.UNMAPPED-ERROR',
      DEFAULT_ERROR_MSG: 'Something went wrong, please try after sometime',
      DEFAULT_ERROR_DESC: 'Error is not mapped in the service, please check log for further info'
    };

    // Mocking dotenv to simulate the loading of a .env file
    (dotenv.config as jest.Mock).mockImplementation(() => ({
      path: path.join(process.cwd(), `.env${process.env.NODE_ENV === 'test' ? '.test' : ''}`)
    }));
  });

  afterAll(() => {
    // Clean up environment variables after all tests
    delete process.env.NODE_ENV;
    delete process.env.APP_NAME;
    delete process.env.APP_VERSION;
    delete process.env.APP_DESCRIPTION;
    delete process.env.APP_HOST;
    delete process.env.APP_SCHEMA;
    delete process.env.APP_ROUTE_PREFIX;
    delete process.env.PORT;
    delete process.env.APP_BANNER;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_JSON;
    delete process.env.LOG_OUTPUT;
    delete process.env.MONGO_URL;
    delete process.env.MONITOR_ENABLED;
    delete process.env.MONITOR_ROUTE;
    delete process.env.MONITOR_USERNAME;
    delete process.env.MONITOR_PASSWORD;
    delete process.env.ERROR_CODE_PREFIX;
    delete process.env.DEFAULT_ERROR_CODE;
    delete process.env.DEFAULT_ERROR_MSG;
    delete process.env.DEFAULT_ERROR_DESC;
  });

  it('should have the correct node environment', () => {
    expect(env.node).toEqual(process.env.NODE_ENV || 'development');
  });

  it('should correctly determine if it is production', () => {
    expect(env.isProduction).toEqual(process.env.NODE_ENV === 'production');
  });

  it('should correctly determine if it is test', () => {
    expect(env.isTest).toEqual(process.env.NODE_ENV === 'test');
  });

  it('should correctly determine if it is development', () => {
    expect(env.isDevelopment).toEqual(process.env.NODE_ENV === 'development');
  });

  it('should have the correct app name', () => {
    expect(env.app.name).toEqual('nodejs-typescript-express-server');
  });

  it('should have the correct app version', () => {
    expect(env.app.version).toEqual('1.0.0');
  });

  it('should have the correct app description', () => {
    expect(env.app.description).toEqual('NodeJS TypeScript Express Server');
  });

  it('should have the correct app host', () => {
    expect(env.app.host).toEqual(process.env.APP_HOST || 'localhost');
  });

  it('should have the correct app schema', () => {
    expect(env.app.schema).toEqual(process.env.APP_SCHEMA || 'http');
  });

  it('should have the correct app routePrefix', () => {
    expect(env.app.routePrefix).toEqual(process.env.APP_ROUTE_PREFIX || '/service/api');
  });

  it('should have the correct app port', () => {
    expect(env.app.port).toEqual(3002);
  });

  it('should have the correct app banner', () => {
    expect(env.app.banner).toEqual(process.env.APP_BANNER === 'true');
  });

  it('should have the correct log level', () => {
    expect(env.log.level).toEqual('info');
  });

  it('should correctly determine if log output is in json format', () => {
    expect(env.log.json).toEqual(process.env.LOG_JSON === 'true');
  });

  it('should have the correct log output', () => {
    expect(env.log.output).toEqual('stdout');
  });

  it('should have the correct mongoURL', () => {
    expect(env.db.mongoURL).toEqual(process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/ServiceDB');
  });

  it('should correctly determine if monitor is enabled', () => {
    expect(env.monitor.enabled).toEqual(process.env.MONITOR_ENABLED === 'true');
  });

  it('should have the correct monitor route', () => {
    expect(env.monitor.route).toEqual('/status');
  });

  it('should have the correct monitor username', () => {
    expect(env.monitor.username).toEqual('admin');
  });

  it('should have the correct monitor password', () => {
    expect(env.monitor.password).toEqual('admin');
  });

  it('should have the correct error prefix', () => {
    expect(env.errors.errorPrefix).toEqual(process.env.ERROR_CODE_PREFIX || 'SERVICE');
  });

  it('should have the correct default error code', () => {
    expect(env.errors.default.errorCode).toEqual(process.env.DEFAULT_ERROR_CODE || 'GLOBAL.UNMAPPED-ERROR');
  });

  it('should have the correct default error message', () => {
    expect(env.errors.default.errorMessage).toEqual(
      process.env.DEFAULT_ERROR_MSG || 'Something went wrong, please try after sometime'
    );
  });

  it('should have the correct default error description', () => {
    expect(env.errors.default.errorDescription).toEqual(
      process.env.DEFAULT_ERROR_DESC || 'Error is not mapped in the service, please check log for further info'
    );
  });
});
