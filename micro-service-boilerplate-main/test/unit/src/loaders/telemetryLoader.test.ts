import { EventEmitter } from 'events';

interface IEnvTelemetryConfig {
  enabled: boolean;
  serviceName: string;
  traceExporterUrl?: string;
  diagnosticsEnabled?: boolean;
  metricsEnabled: boolean;
  metricsPort: number;
  metricsPath: string;
}

const buildEnv = (telemetryOverride?: Partial<IEnvTelemetryConfig>) => ({
  node: 'test',
  isProduction: false,
  isDevelopment: false,
  isTest: true,
  app: {
    name: 'telemetry-service',
    version: '0.0.0-test',
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
  telemetry: {
    enabled: false,
    serviceName: 'telemetry-service',
    traceExporterUrl: '',
    diagnosticsEnabled: false,
    metricsEnabled: false,
    metricsPort: 9464,
    metricsPath: '/metrics',
    ...telemetryOverride
  }
});

type EnvConfig = ReturnType<typeof buildEnv>;

type LoadOptions = {
  telemetry?: Partial<IEnvTelemetryConfig>;
  envOverrides?: Partial<EnvConfig>;
  configureMocks?: () => void;
};

const loadTelemetryModule = (options?: LoadOptions) => {
  jest.resetModules();
  const envConfig: EnvConfig = {
    ...buildEnv(options?.telemetry),
    ...(options?.envOverrides || {})
  };

  jest.doMock('@env', () => ({
    env: envConfig
  }));

  if (options?.configureMocks) {
    options.configureMocks();
  }

  return require('../../../../src/loaders/telemetryLoader');
};

class MockResponse extends EventEmitter {
  public statusCode = 200;
  public headers: Record<string, string> = {};
  public body = '';

  public setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }

  public getHeader(name: string) {
    return this.headers[name.toLowerCase()];
  }

  public status(code: number) {
    this.statusCode = code;
    return this;
  }

  public send(payload?: string) {
    if (payload) {
      this.body = payload;
    }
    this.emit('finish');
  }

  public end(payload?: string) {
    if (payload) {
      this.body = payload;
    }
    this.emit('finish');
  }
}

describe('telemetryLoader', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('does not initialise tracing when disabled by configuration', async () => {
    const telemetryModule = loadTelemetryModule({ telemetry: { enabled: false } });

    await telemetryModule.initializeTelemetry();

    expect(telemetryModule.telemetryState.isTracingEnabled()).toBe(false);
    expect(telemetryModule.telemetryState.isMetricsEnabled()).toBe(false);
    await telemetryModule.resetTelemetryForTests();
  });

  it('initialises tracing when enabled and skips duplicate bootstraps', async () => {
    const telemetryModule = loadTelemetryModule({ telemetry: { enabled: true, metricsEnabled: false } });

    await telemetryModule.initializeTelemetry();
    await telemetryModule.initializeTelemetry();

    expect(telemetryModule.telemetryState.isTracingEnabled()).toBe(true);
    expect(telemetryModule.telemetryState.isMetricsEnabled()).toBe(false);

    await telemetryModule.resetTelemetryForTests();
  });

  it('configures diagnostics logger and OTLP exporter when provided', async () => {
    const exporterSpy = jest.fn();
    const telemetryModule = loadTelemetryModule({
      telemetry: {
        enabled: true,
        metricsEnabled: false,
        diagnosticsEnabled: true,
        traceExporterUrl: 'http://collector:4318/v1/traces'
      },
      configureMocks: () => {
        jest.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
          OTLPTraceExporter: jest.fn().mockImplementation(options => {
            exporterSpy(options);
            return {};
          })
        }));
      }
    });

    const { diag } = require('@opentelemetry/api');
    const setLoggerSpy = jest.spyOn(diag, 'setLogger');

    await telemetryModule.initializeTelemetry();
    await telemetryModule.initializeTelemetry();

    expect(exporterSpy).toHaveBeenCalledWith({ url: 'http://collector:4318/v1/traces' });
    expect(setLoggerSpy).toHaveBeenCalled();

    await telemetryModule.resetTelemetryForTests();
  });

  it('records metrics for different route shapes and handles error responses', async () => {
    const telemetryModule = loadTelemetryModule({ telemetry: { enabled: true, metricsEnabled: true } });
    await telemetryModule.initializeTelemetry();

    const requests = [
      {
        req: {
          method: 'GET',
          originalUrl: '/health',
          baseUrl: '',
          path: '/health',
          protocol: 'http',
          headers: { 'unique-reference-code': 'abc-123', host: 'localhost', 'user-agent': 'jest' },
          get: (header: string) => (header.toLowerCase() === 'host' ? 'localhost' : undefined),
          route: { path: '/health' }
        },
        emit: 'finish',
        status: 200
      },
      {
        req: {
          method: 'POST',
          originalUrl: '/base-route/action',
          baseUrl: '/base-route',
          path: undefined,
          protocol: 'http',
          headers: { 'unique-reference-code': 'abc-456', host: 'localhost', 'user-agent': 'jest' },
          get: (header: string) => (header.toLowerCase() === 'host' ? 'localhost' : undefined)
        },
        emit: 'finish',
        status: 201
      },
      {
        req: {
          method: 'DELETE',
          originalUrl: '/fallback-route?debug=true',
          baseUrl: undefined,
          path: undefined,
          protocol: 'http',
          headers: { 'unique-reference-code': 'abc-789', host: 'localhost', 'user-agent': 'jest' },
          get: (header: string) => (header.toLowerCase() === 'host' ? 'localhost' : undefined)
        },
        emit: 'close',
        status: 503
      }
    ];

    for (const scenario of requests) {
      const res = new MockResponse();
      const next = jest.fn(() => {
        res.statusCode = scenario.status;
        res.emit(scenario.emit);
      });

      telemetryModule.telemetryMiddleware(scenario.req as any, res as any, next);
      expect(next).toHaveBeenCalled();
    }

    const metricsRes = new MockResponse();
    await telemetryModule.telemetryMetricsHandler({} as any, metricsRes as any);

    expect(metricsRes.statusCode).toBe(200);
    expect(metricsRes.body).toContain('/health');
    expect(metricsRes.body).toContain('/base-route');
    expect(metricsRes.body).toContain('/fallback-route');

    await telemetryModule.resetTelemetryForTests();
  });

  it('returns 404 for metrics endpoint when metrics are disabled', async () => {
    const telemetryModule = loadTelemetryModule({ telemetry: { enabled: true, metricsEnabled: false } });
    await telemetryModule.initializeTelemetry();

    const res = new MockResponse();
    await telemetryModule.telemetryMetricsHandler({} as any, res as any);

    expect(res.statusCode).toBe(404);

    await telemetryModule.resetTelemetryForTests();
  });

  it('returns 500 when metrics collection fails', async () => {
    const telemetryModule = loadTelemetryModule({ telemetry: { enabled: true, metricsEnabled: true } });
    await telemetryModule.initializeTelemetry();

    const { Registry } = require('prom-client');
    const metricsSpy = jest.spyOn(Registry.prototype, 'metrics').mockRejectedValueOnce(new Error('boom'));

    const res = new MockResponse();
    await telemetryModule.telemetryMetricsHandler({} as any, res as any);

    expect(res.statusCode).toBe(500);

    metricsSpy.mockRestore();
    await telemetryModule.resetTelemetryForTests();
  });

  it('starts metrics server when not in test env and shuts down cleanly', async () => {
    const closeSpy = jest.fn(cb => {
      if (cb) {
        cb();
      }
    });
    const listenSpy = jest.fn((_port, cb) => {
      if (cb) {
        cb();
      }
    });
    const onSpy = jest.fn();
    const handlerRef: { handler?: (req: any, res: any) => Promise<void> } = {};

    const telemetryModule = loadTelemetryModule({
      telemetry: { enabled: true, metricsEnabled: true },
      envOverrides: { isTest: false },
      configureMocks: () => {
        jest.doMock('http', () => ({
          createServer: jest.fn().mockImplementation(handler => {
            handlerRef.handler = handler;
            return {
              listen: listenSpy,
              on: onSpy,
              close: closeSpy
            };
          })
        }));
      }
    });

    await telemetryModule.initializeTelemetry();

    expect(listenSpy).toHaveBeenCalled();
    expect(onSpy).toHaveBeenCalledWith('error', expect.any(Function));

    const wrongPathRes = new MockResponse();
    await handlerRef.handler?.({ url: '/wrong' }, wrongPathRes as any);
    expect(wrongPathRes.statusCode).toBe(404);

    await telemetryModule.shutdownTelemetry();
    expect(closeSpy).toHaveBeenCalled();

    const afterShutdownRes = new MockResponse();
    await handlerRef.handler?.({ url: '/metrics' }, afterShutdownRes as any);
    expect(afterShutdownRes.statusCode).toBe(503);

    await telemetryModule.resetTelemetryForTests();
  });
});
