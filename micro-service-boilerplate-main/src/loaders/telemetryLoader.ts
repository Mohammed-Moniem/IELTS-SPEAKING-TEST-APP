import { env } from '@env';
import { Logger } from '@lib/logger';
import type { NextFunction, Request, Response } from 'express';
import { createServer, Server } from 'http';
import { context, diag, DiagConsoleLogger, DiagLogLevel, SpanStatusCode, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SemanticAttributes, SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

const log = new Logger(__filename);

interface ITelemetryConfig {
  enabled: boolean;
  serviceName: string;
  traceExporterUrl?: string;
  diagnosticsEnabled: boolean;
  metricsEnabled: boolean;
  metricsPort: number;
  metricsPath: string;
}

const DEFAULT_TELEMETRY_CONFIG: ITelemetryConfig = {
  enabled: false,
  serviceName: env.app?.name || 'service-app',
  traceExporterUrl: undefined,
  diagnosticsEnabled: false,
  metricsEnabled: false,
  metricsPort: 9464,
  metricsPath: '/metrics'
};

const getTelemetryConfig = (): ITelemetryConfig => ({
  ...DEFAULT_TELEMETRY_CONFIG,
  ...(env.telemetry || {})
});

let tracerProvider: NodeTracerProvider | undefined;
let tracerInstance = trace.getTracer('default');
let metricsRegistry: Registry | undefined;
let requestDurationHistogram: Histogram<string> | undefined;
let requestCounter: Counter<string> | undefined;
let metricsServer: Server | undefined;
let telemetryBootstrapped = false;
let metricsBootstrapped = false;
let diagnosticsConfigured = false;

const HTTP_DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

const setupTracing = () => {
  const config = getTelemetryConfig();

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: env.app.version,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env.node
  });

  tracerProvider = new NodeTracerProvider({ resource });

  if (config.traceExporterUrl) {
    const exporter = new OTLPTraceExporter({ url: config.traceExporterUrl });
    tracerProvider.addSpanProcessor(new BatchSpanProcessor(exporter));
  }

  tracerProvider.register();
  tracerInstance = trace.getTracer(config.serviceName);
  telemetryBootstrapped = true;
  log.info('OpenTelemetry tracing initialised');
};

const setupMetrics = () => {
  const config = getTelemetryConfig();

  metricsRegistry = new Registry();
  collectDefaultMetrics({ register: metricsRegistry });

  requestDurationHistogram = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: HTTP_DURATION_BUCKETS,
    registers: [metricsRegistry]
  });

  requestCounter = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [metricsRegistry]
  });

  metricsBootstrapped = true;

  if (!env.isTest) {
    metricsServer = createServer(async (req, res) => {
      try {
        if (!metricsRegistry) {
          res.statusCode = 503;
          res.end();
          return;
        }

        const path = (req.url || '').split('?')[0];
        const { metricsPath } = getTelemetryConfig();
        if (path !== metricsPath) {
          res.statusCode = 404;
          res.end();
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', metricsRegistry.contentType);
        const metrics = await metricsRegistry.metrics();
        res.end(metrics);
      } catch (error) {
        log.error('Failed to serve Prometheus metrics', { error });
        res.statusCode = 500;
        res.end();
      }
    });

    const { metricsPort, metricsPath } = config;
    metricsServer.listen(metricsPort, () => {
      log.info(`Prometheus metrics available on port ${metricsPort}${metricsPath}`);
    });

    metricsServer.on('error', error => {
      log.error('Prometheus metrics server error', { error });
    });
  } else {
    log.info('Prometheus metrics initialised in test mode');
  }
};

export const initializeTelemetry = async (): Promise<void> => {
  const config = getTelemetryConfig();

  if (!config.enabled) {
    log.info('Telemetry disabled via configuration');
    return;
  }

  if (!diagnosticsConfigured && config.diagnosticsEnabled) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    diagnosticsConfigured = true;
  }

  if (telemetryBootstrapped) {
    log.info('Telemetry already initialised, skipping');
    return;
  }

  try {
    setupTracing();

    if (config.metricsEnabled && !metricsBootstrapped) {
      setupMetrics();
    }
  } catch (error) {
    log.error('Failed to initialize telemetry', { error });
  }
};

export const telemetryMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const config = getTelemetryConfig();

  if (!config.enabled || !telemetryBootstrapped) {
    return next();
  }

  const activeTracer = tracerInstance || trace.getTracer(config.serviceName);
  const start = process.hrtime();
  const span = activeTracer.startSpan('http.request', {
    attributes: {
      [SemanticAttributes.HTTP_METHOD]: req.method,
      [SemanticAttributes.HTTP_TARGET]: req.originalUrl,
      [SemanticAttributes.HTTP_URL]: `${req.protocol || 'http'}://${req.get('host') || ''}${req.originalUrl}`,
      [SemanticAttributes.HTTP_USER_AGENT]: req.headers['user-agent'] || '',
      'app.unique_reference_code': req.headers['unique-reference-code'] || ''
    }
  });

  let spanEnded = false;

  const finalize = () => {
    if (spanEnded) {
      return;
    }
    spanEnded = true;

    const diff = process.hrtime(start);
    const duration = diff[0] + diff[1] / 1_000_000_000;
    const statusCode = res.statusCode || 0;
    span.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, statusCode);

    if (statusCode >= 500) {
      span.setStatus({ code: SpanStatusCode.ERROR });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();

    if (metricsBootstrapped && metricsRegistry && requestDurationHistogram && requestCounter) {
      const routePath = resolveRoute(req);
      const labels = {
        method: req.method,
        route: routePath,
        status: String(statusCode || 0)
      };

      requestCounter.inc(labels);
      requestDurationHistogram.observe(labels, duration);
    }

    res.removeListener('finish', finalize);
    res.removeListener('close', finalize);
  };

  res.on('finish', finalize);
  res.on('close', finalize);

  return context.with(trace.setSpan(context.active(), span), next);
};

export const telemetryMetricsHandler = async (req: Request, res: Response) => {
  const config = getTelemetryConfig();

  if (!config.metricsEnabled || !metricsRegistry) {
    res.status(404).send('Metrics disabled');
    return;
  }

  try {
    res.setHeader('Content-Type', metricsRegistry.contentType);
    const metrics = await metricsRegistry.metrics();
    res.status(200).send(metrics);
  } catch (error) {
    log.error('Failed to collect telemetry metrics', { error });
    res.status(500).send('Failed to collect metrics');
  }
};

export const shutdownTelemetry = async (): Promise<void> => {
  try {
    if (metricsServer) {
      await new Promise<void>(resolve => metricsServer?.close(() => resolve()));
      metricsServer = undefined;
    }

    if (tracerProvider) {
      await tracerProvider.shutdown();
    }
  } catch (error) {
    log.error('Failed to shutdown telemetry cleanly', { error });
  } finally {
    tracerProvider = undefined;
    tracerInstance = trace.getTracer('default');
    metricsRegistry = undefined;
    requestDurationHistogram = undefined;
    requestCounter = undefined;
    telemetryBootstrapped = false;
    metricsBootstrapped = false;
  }
};

const resolveRoute = (req: Request) => {
  if (req.route?.path) {
    return `${req.baseUrl || ''}${req.route.path}` || req.originalUrl || req.path || 'unknown';
  }

  if (req.baseUrl) {
    return req.baseUrl;
  }

  if (req.path) {
    return req.path;
  }

  return req.originalUrl?.split('?')[0] || 'unknown';
};

export const telemetryState = {
  isTracingEnabled: () => telemetryBootstrapped,
  isMetricsEnabled: () => metricsBootstrapped
};

export const resetTelemetryForTests = async () => {
  await shutdownTelemetry();
};

if (!env.isTest) {
  initializeTelemetry().catch(error => {
    log.error('Telemetry bootstrap failed', { error });
  });
}
