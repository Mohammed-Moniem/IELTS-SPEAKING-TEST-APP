import { env } from '@env';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { checkPgConnection } from '@lib/db/pgClient';
import { checkSupabaseStorageConnection } from '@lib/db/supabaseClient';
import { constructLogMessage, isEmptyOrNull } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import os from 'os';
import { performance } from 'perf_hooks';
import { Service } from 'typedi';

import { isConnected as isRabbitConnected } from '@loaders/RabbitMQLoader';

type DiagnosticsMemoryUsage = ReturnType<typeof process.memoryUsage>;
type DiagnosticsCPUUsage = ReturnType<typeof process.cpuUsage>;

export type DependencyStatus = 'pass' | 'warn' | 'fail' | 'skipped';

export interface IHealthDependencyCheck {
  name: string;
  status: DependencyStatus;
  message: string;
  latencyMs?: number;
  lastUpdated: string;
}

export interface IReadinessReport {
  status: 'pass' | 'warn' | 'fail';
  dependencies: IHealthDependencyCheck[];
}

export interface ILivenessReport {
  status: DependencyStatus;
  message: string;
}

export interface IDiagnosticsReport {
  memory: DiagnosticsMemoryUsage;
  cpu: DiagnosticsCPUUsage;
  loadAverage: number[];
  eventLoopUtilization?: {
    idle: number;
    active: number;
    utilization: number;
  };
  eventLoopSampleMs: number;
}

export interface IHealthResponse {
  status: 'ok' | 'degraded' | 'unavailable';
  uptime: number;
  version: string;
  timestamp: string;
  liveness: ILivenessReport;
  readiness: IReadinessReport;
  diagnostics?: IDiagnosticsReport;
}

const toMilliseconds = (hrtime: [number, number]): number =>
  Number((hrtime[0] * 1000 + hrtime[1] / 1_000_000).toFixed(3));

@Service()
export class HealthService {
  private log = new Logger(__filename);

  public async getHealthStatus(headers: IRequestHeaders): Promise<IHealthResponse> {
    const logMessage = constructLogMessage(__filename, 'getHealthStatus', headers);
    this.log.info(`${logMessage} :: Evaluating service health`);

    try {
      const readiness = await this.evaluateReadiness(headers);
      const liveness = this.evaluateLiveness(headers);
      const diagnostics = env.health.selfDiagnosticsEnabled ? this.buildDiagnostics(headers) : undefined;

      const overallStatus = this.determineOverallStatus(readiness.status);

      const response: IHealthResponse = {
        status: overallStatus,
        uptime: process.uptime(),
        version: env.app.version,
        timestamp: new Date().toISOString(),
        liveness,
        readiness
      };

      if (diagnostics) {
        response.diagnostics = diagnostics;
      }

      return response;
    } catch (error) {
      this.log.error(`${logMessage} :: Failed to compute health status`, { error });
      throw error;
    }
  }

  private determineOverallStatus(readinessStatus: IReadinessReport['status']): 'ok' | 'degraded' | 'unavailable' {
    if (readinessStatus === 'fail') {
      return 'unavailable';
    }

    if (readinessStatus === 'warn') {
      return 'degraded';
    }

    return 'ok';
  }

  private evaluateLiveness(headers: IRequestHeaders): ILivenessReport {
    const logMessage = constructLogMessage(__filename, 'evaluateLiveness', headers);
    this.log.debug(`${logMessage} :: Calculating liveness probe`);

    return {
      status: 'pass',
      message: 'Service is running'
    };
  }

  private async evaluateReadiness(headers: IRequestHeaders): Promise<IReadinessReport> {
    const logMessage = constructLogMessage(__filename, 'evaluateReadiness', headers);
    this.log.debug(`${logMessage} :: Calculating readiness probe`);

    if (!env.health.dependencyChecksEnabled) {
      this.log.debug(`${logMessage} :: Dependency checks disabled via configuration`);
      const skippedDependencies: IHealthDependencyCheck[] = [
        {
          name: 'supabase_db',
          status: 'skipped',
          message: 'Dependency checks disabled',
          lastUpdated: new Date().toISOString()
        },
        {
          name: 'supabase_storage',
          status: 'skipped',
          message: 'Dependency checks disabled',
          lastUpdated: new Date().toISOString()
        },
        {
          name: 'rabbitmq',
          status: 'skipped',
          message: 'Dependency checks disabled',
          lastUpdated: new Date().toISOString()
        },
        {
          name: env.health.cacheServiceName,
          status: 'skipped',
          message: 'Dependency checks disabled',
          lastUpdated: new Date().toISOString()
        }
      ];

      return {
        status: 'pass',
        dependencies: skippedDependencies
      };
    }

    const dependencyResults = await Promise.all([
      this.checkSupabaseDB(headers),
      this.checkSupabaseStorage(headers),
      this.checkRabbitMQ(headers),
      this.checkCache(headers)
    ]);

    const statuses = dependencyResults.map(result => result.status);

    if (statuses.includes('fail')) {
      return {
        status: 'fail',
        dependencies: dependencyResults
      };
    }

    if (statuses.includes('warn')) {
      return {
        status: 'warn',
        dependencies: dependencyResults
      };
    }

    return {
      status: 'pass',
      dependencies: dependencyResults
    };
  }

  private async checkSupabaseDB(headers: IRequestHeaders): Promise<IHealthDependencyCheck> {
    const logMessage = constructLogMessage(__filename, 'checkSupabaseDB', headers);
    const start = process.hrtime();

    try {
      await checkPgConnection();
      const status: DependencyStatus = 'pass';
      const message = 'Supabase Postgres connection established';

      const latency = toMilliseconds(process.hrtime(start));
      this.log.debug(`${logMessage} :: Supabase DB readiness status: ${status}`);

      return {
        name: 'supabase_db',
        status,
        message,
        latencyMs: latency,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      this.log.error(`${logMessage} :: Supabase DB readiness check failed`, { error });
      return {
        name: 'supabase_db',
        status: 'fail',
        message: 'Unexpected error while checking Supabase Postgres',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  private async checkSupabaseStorage(headers: IRequestHeaders): Promise<IHealthDependencyCheck> {
    const logMessage = constructLogMessage(__filename, 'checkSupabaseStorage', headers);
    const start = process.hrtime();

    if (env.storage.provider !== 'supabase') {
      return {
        name: 'supabase_storage',
        status: 'skipped',
        message: 'Supabase storage integration disabled',
        lastUpdated: new Date().toISOString()
      };
    }

    try {
      await checkSupabaseStorageConnection();
      const latency = toMilliseconds(process.hrtime(start));
      return {
        name: 'supabase_storage',
        status: 'pass',
        message: 'Supabase storage connection established',
        latencyMs: latency,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      this.log.error(`${logMessage} :: Supabase storage readiness check failed`, { error });
      return {
        name: 'supabase_storage',
        status: 'fail',
        message: 'Unexpected error while checking Supabase storage',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  private async checkRabbitMQ(headers: IRequestHeaders): Promise<IHealthDependencyCheck> {
    const logMessage = constructLogMessage(__filename, 'checkRabbitMQ', headers);
    const start = process.hrtime();

    try {
      if (!env.rabbitmq.enabled) {
        this.log.debug(`${logMessage} :: RabbitMQ disabled via configuration`);
        return {
          name: 'rabbitmq',
          status: 'skipped',
          message: 'RabbitMQ integration disabled',
          lastUpdated: new Date().toISOString()
        };
      }

      const connected = isRabbitConnected();
      const status: DependencyStatus = connected ? 'pass' : 'fail';
      const message = connected ? 'RabbitMQ connected' : 'RabbitMQ not connected';

      const latency = toMilliseconds(process.hrtime(start));
      this.log.debug(`${logMessage} :: RabbitMQ readiness status: ${status}`);

      return {
        name: 'rabbitmq',
        status,
        message,
        latencyMs: latency,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      this.log.error(`${logMessage} :: RabbitMQ readiness check failed`, { error });
      return {
        name: 'rabbitmq',
        status: 'fail',
        message: 'Unexpected error while checking RabbitMQ',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  private async checkCache(headers: IRequestHeaders): Promise<IHealthDependencyCheck> {
    const logMessage = constructLogMessage(__filename, 'checkCache', headers);

    if (!env.health.cacheCheckEnabled) {
      this.log.debug(`${logMessage} :: Cache checks disabled via configuration`);
      return {
        name: env.health.cacheServiceName,
        status: 'skipped',
        message: 'Cache health checks disabled',
        lastUpdated: new Date().toISOString()
      };
    }

    const cacheName = isEmptyOrNull(env.health.cacheServiceName) ? 'cache' : env.health.cacheServiceName;

    this.log.warn(
      `${logMessage} :: Cache checks enabled but no cache implementation available. Marking as warn status.`
    );

    return {
      name: cacheName,
      status: 'warn',
      message: 'Cache checks enabled without an implementation',
      lastUpdated: new Date().toISOString()
    };
  }

  private buildDiagnostics(headers: IRequestHeaders): IDiagnosticsReport {
    const logMessage = constructLogMessage(__filename, 'buildDiagnostics', headers);
    this.log.debug(`${logMessage} :: Collecting diagnostics data`);

    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    const loadAverage = os.loadavg();

    let eventLoopUtilization: IDiagnosticsReport['eventLoopUtilization'];

    if (typeof performance.eventLoopUtilization === 'function') {
      const utilizationSample = performance.eventLoopUtilization();

      eventLoopUtilization = {
        idle: Number(utilizationSample.idle.toFixed(4)),
        active: Number(utilizationSample.active.toFixed(4)),
        utilization: Number(utilizationSample.utilization.toFixed(4))
      };
    }

    return {
      memory,
      cpu,
      loadAverage,
      eventLoopUtilization,
      eventLoopSampleMs: env.health.eventLoopSampleMs
    };
  }
}
