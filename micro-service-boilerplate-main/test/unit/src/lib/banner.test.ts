import { MockLogger } from '../../../../test/unit/mocks/Logger';

jest.mock('../../../../src/lib/logger', () => {
  return {
    Logger: jest.fn().mockImplementation(() => {
      return {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };
    })
  };
});

// Mocking `env` generally
jest.mock('../../../../src/env', () => ({
  env: {
    app: {
      banner: true, // Default to true, override in tests if needed
      schema: 'http',
      host: 'localhost',
      port: 3000,
      routePrefix: '/api',
      version: '1.0.0'
    },
    node: 'development',
    monitor: {
      enabled: true,
      route: '/monitor'
    }
  }
}));

describe('banner', () => {
  let log: MockLogger;
  let banner;

  beforeEach(async () => {
    log = new MockLogger();
    banner = (await import('../../../../src/lib/banner')).banner;
    log = new MockLogger();
    jest.resetModules();
  });

  it('should log the banner when the banner is enabled', () => {
    banner(log as any);
    expect(log.info).toHaveBeenCalledTimes(12);
  });

  it('should log a simple message when the banner is disabled', async () => {
    jest.doMock('../../../../src/env', () => ({
      env: {
        app: {
          banner: false
        }
      }
    }));
    banner = (await import('../../../../src/lib/banner')).banner;
    banner(log as any);
    expect(log.info).toHaveBeenCalledWith('Application is up and running.');
  });
});
