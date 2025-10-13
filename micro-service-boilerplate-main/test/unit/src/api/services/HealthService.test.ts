import 'reflect-metadata';

import { IRequestHeaders } from '../../../../../src/api/Interface/IRequestHeaders';

interface IHealthEnvOverrides {
  dependencyChecksEnabled?: boolean;
  selfDiagnosticsEnabled?: boolean;
  cacheCheckEnabled?: boolean;
  cacheServiceName?: string;
  eventLoopSampleMs?: number;
}

interface IHealthTestOptions {
  telemetryEnabled?: boolean;
  mongoState?: number;
  rabbitEnabled?: boolean;
  rabbitConnected?: boolean;
  healthConfig?: IHealthEnvOverrides;
}

describe('HealthService', () => {
  const loadModule = (options: IHealthTestOptions = {}) => {
    jest.resetModules();

    const {
      mongoState = 1,
      rabbitEnabled = false,
      rabbitConnected = false,
      healthConfig = {}
    } = options;

    const healthDefaults = {
      dependencyChecksEnabled: true,
      selfDiagnosticsEnabled: false,
      cacheCheckEnabled: false,
      cacheServiceName: 'cache',
      eventLoopSampleMs: 25,
      ...healthConfig
    };

    jest.doMock('@env', () => ({
      env: {
        node: 'test',
        app: {
          name: 'health-service',
          version: '1.0.0',
          description: 'test',
          host: 'localhost',
          schema: 'http',
          routePrefix: '/service/api',
          port: 3000,
          banner: false,
          apiKey: 'test-key',
          rateWindowMs: 60000,
          rateMax: 60,
          corsOrigin: '*',
          dirs: {
            controllers: [],
            middlewares: [],
            interceptors: [],
            resolvers: []
          }
        },
        health: healthDefaults,
        rabbitmq: {
          enabled: rabbitEnabled
        }
      }
    }));

    jest.doMock('mongoose', () => ({
      connection: {
        readyState: mongoState
      }
    }));

    const rabbitMock = {
      isConnected: jest.fn(() => rabbitConnected)
    };

    jest.doMock('@loaders/RabbitMQLoader', () => rabbitMock);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require('../../../../../src/api/services/HealthService');

    return {
      module,
      rabbitMock
    };
  };

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('returns base health response when dependency checks are disabled', async () => {
    const { module } = loadModule({
      healthConfig: {
        dependencyChecksEnabled: false
      }
    });

    const { HealthService } = module as typeof import('../../../../../src/api/services/HealthService');
    const service = new HealthService();

    const headers: IRequestHeaders = { urc: 'test-urc' };
    const result = await service.getHealthStatus(headers);

    expect(result.status).toBe('ok');
    expect(result.readiness.status).toBe('pass');
    expect(result.readiness.dependencies.every(dep => dep.status === 'skipped')).toBe(true);
    expect(result.liveness.status).toBe('pass');
  });

  it('reports degraded status when cache warning occurs', async () => {
    const { module } = loadModule({
      mongoState: 2,
      healthConfig: {
        cacheCheckEnabled: true,
        cacheServiceName: 'redis'
      }
    });

    const { HealthService } = module as typeof import('../../../../../src/api/services/HealthService');
    const service = new HealthService();

    const headers: IRequestHeaders = { urc: 'test-urc' };
    const result = await service.getHealthStatus(headers);

    expect(result.status).toBe('degraded');
    expect(result.readiness.status).toBe('warn');
    const cacheCheck = result.readiness.dependencies.find(dep => dep.name === 'redis');
    expect(cacheCheck?.status).toBe('warn');
  });

  it('reports unavailable when rabbitmq connectivity fails', async () => {
    const { module, rabbitMock } = loadModule({
      rabbitEnabled: true,
      rabbitConnected: false
    });

    const { HealthService } = module as typeof import('../../../../../src/api/services/HealthService');
    const service = new HealthService();

    const headers: IRequestHeaders = { urc: 'test-urc' };
    const result = await service.getHealthStatus(headers);

    expect(rabbitMock.isConnected).toHaveBeenCalled();
    expect(result.readiness.status).toBe('fail');
    expect(result.status).toBe('unavailable');
  });

  it('includes diagnostics when enabled', async () => {
    const { module } = loadModule({
      healthConfig: {
        dependencyChecksEnabled: false,
        selfDiagnosticsEnabled: true
      }
    });

    const { HealthService } = module as typeof import('../../../../../src/api/services/HealthService');
    const service = new HealthService();

    const headers: IRequestHeaders = { urc: 'test-urc' };
    const result = await service.getHealthStatus(headers);

    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics?.memory).toBeDefined();
    expect(result.diagnostics?.cpu).toBeDefined();
    expect(result.diagnostics?.eventLoopSampleMs).toBeDefined();
  });
});
