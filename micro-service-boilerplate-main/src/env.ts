import * as dotenv from 'dotenv';
import * as path from 'path';
import { toNumber } from './lib/env/utils';

import * as pkg from '../package.json';
import { getOsEnv, getOsPaths, getPaths, normalizePort, toBool } from './lib/env';

/**
 * Load .env file or for tests the .env.test file.
 */
dotenv.config({ path: path.join(process.cwd(), `.env${process.env.NODE_ENV === 'test' ? '.test' : ''}`) });

/**
 * Environment variables
 */
export const env = {
  node: getOsEnv('NODE_ENV') || 'development',
  isProduction: getOsEnv('NODE_ENV') === 'production',
  isTest: getOsEnv('NODE_ENV') === 'test',
  isDevelopment: getOsEnv('NODE_ENV') === 'development',
  app: {
    name: getOsEnv('APP_NAME') || (pkg as any).name,
    version: (pkg as any).version,
    description: (pkg as any).description,
    host: getOsEnv('APP_HOST') || 'localhost',
    schema: getOsEnv('APP_SCHEMA') || 'http',
    routePrefix: getOsEnv('APP_ROUTE_PREFIX') || '/api/v1',
    port: normalizePort(process.env.PORT || getOsEnv('APP_PORT') || '4000'),
    banner: toBool(getOsEnv('APP_BANNER') || 'true'),
    apiKey: getOsEnv('API_KEY'),
    rateWindowMs: toNumber(getOsEnv('RATE_LIMIT_WINDOW_MS')) || 60000,
    rateMax: toNumber(getOsEnv('RATE_LIMIT_MAX')) || 60,
    corsOrigin: getOsEnv('CORS_ORIGIN') || '*',
    dirs: {
      controllers: getOsPaths('CONTROLLERS') || getPaths(['src/api/controllers/**/*Controller.ts']),
      middlewares: getOsPaths('MIDDLEWARES') || getPaths(['src/api/middlewares/*Middleware.ts']),
      interceptors: getOsPaths('INTERCEPTORS') || getPaths(['src/api/interceptors/**/*Interceptor.ts']),
      resolvers: getOsPaths('RESOLVERS') || getPaths(['src/api/resolvers/**/*Resolver.ts'])
    }
  },
  constants: {
    aesIVBase64: getOsEnv('AES_IV_BASE64') || 'AAAAAAAAAAAAAAAAAAAAAA==',
    encryption: {
      algorithm: getOsEnv('ENCRYPTION_ALGORITHM') || 'aes-256-cbc',
      key: getOsEnv('BASE64_ENCRYPTION_KEY') || 'MzVjNWM0NmIxZTQ5YjA2MzZmM2JhODQ0NjI4ZDYwODQ=',
      iv: getOsEnv('BASE64_ENCRYPTION_IV') || 'Nzg5MjM0NzM4NzRmOWIwZA=='
    }
  },
  log: {
    level: getOsEnv('LOG_LEVEL') || 'info',
    json: toBool(getOsEnv('LOG_JSON')) || false,
    output: getOsEnv('LOG_OUTPUT') || 'stdout'
  },
  db: {
    mongoURL: getOsEnv('MONGO_URL') || `mongodb://127.0.0.1:27017/ielts-speaking`,
    supabaseUrl: getOsEnv('SUPABASE_URL') || '',
    supabaseServiceRoleKey: getOsEnv('SUPABASE_SERVICE_ROLE_KEY') || '',
    supabaseDbUrl: getOsEnv('SUPABASE_DB_URL') || '',
    writeMode: (getOsEnv('DB_WRITE_MODE') as 'mongo' | 'dual' | 'supabase') || 'supabase',
    readMode: (getOsEnv('DB_READ_MODE') as 'mongo' | 'supabase') || 'supabase',
    parityLogging: toBool(getOsEnv('DB_PARITY_LOGGING') || 'false')
  },
  jwt: {
    accessSecret: getOsEnv('JWT_ACCESS_SECRET') || 'dev-access-secret',
    refreshSecret: getOsEnv('JWT_REFRESH_SECRET') || 'dev-refresh-secret',
    accessExpiresIn: getOsEnv('JWT_ACCESS_EXPIRES_IN') || '15m',
    refreshExpiresIn: getOsEnv('JWT_REFRESH_EXPIRES_IN') || '7d'
  },
  monitor: {
    enabled: toBool(getOsEnv('MONITOR_ENABLED')),
    route: getOsEnv('MONITOR_ROUTE') || '/status',
    username: getOsEnv('MONITOR_USERNAME') || 'admin',
    password: getOsEnv('MONITOR_PASSWORD') || 'admin'
  },
  telemetry: {
    enabled: toBool(getOsEnv('TELEMETRY_ENABLED')) || false,
    serviceName: getOsEnv('TELEMETRY_SERVICE_NAME') || getOsEnv('APP_NAME') || (pkg as any).name,
    traceExporterUrl: getOsEnv('TELEMETRY_TRACE_EXPORTER_URL'),
    diagnosticsEnabled: toBool(getOsEnv('TELEMETRY_DIAGNOSTICS_ENABLED')) || false,
    metricsEnabled: toBool(getOsEnv('TELEMETRY_METRICS_ENABLED')) || false,
    metricsPort: toNumber(getOsEnv('TELEMETRY_METRICS_PORT')) || 9464,
    metricsPath: getOsEnv('TELEMETRY_METRICS_PATH') || '/metrics'
  },
  payments: {
    stripe: {
      secretKey: getOsEnv('STRIPE_SECRET_KEY'),
      publishableKey: getOsEnv('STRIPE_PUBLISHABLE_KEY'),
      webhookSecret: getOsEnv('STRIPE_WEBHOOK_SECRET'),
      defaultSuccessUrl: getOsEnv('STRIPE_DEFAULT_SUCCESS_URL'),
      defaultCancelUrl: getOsEnv('STRIPE_DEFAULT_CANCEL_URL'),
      priceIds: {
        premium: getOsEnv('STRIPE_PRICE_PREMIUM'),
        pro: getOsEnv('STRIPE_PRICE_PRO')
      }
    }
  },
  health: {
    dependencyChecksEnabled: toBool(getOsEnv('HEALTH_DEPENDENCY_CHECKS_ENABLED') || 'true') || false,
    selfDiagnosticsEnabled: toBool(getOsEnv('HEALTH_SELF_DIAGNOSTICS_ENABLED')) || false,
    cacheCheckEnabled: toBool(getOsEnv('HEALTH_CACHE_CHECK_ENABLED')) || false,
    cacheServiceName: getOsEnv('HEALTH_CACHE_SERVICE_NAME') || 'cache',
    eventLoopSampleMs: toNumber(getOsEnv('HEALTH_EVENT_LOOP_SAMPLE_MS')) || 25
  },
  openai: {
    apiKey: getOsEnv('OPENAI_API_KEY'),
    model: getOsEnv('OPENAI_MODEL') || 'gpt-3.5-turbo',
    ttsModel: getOsEnv('OPENAI_TTS_MODEL') || 'gpt-4o-mini-tts',
    ttsVoice: getOsEnv('OPENAI_TTS_VOICE') || 'alloy',
    maxTokens: toNumber(getOsEnv('OPENAI_MAX_TOKENS')) || 1000,
    temperature: parseFloat(getOsEnv('OPENAI_TEMPERATURE') || '0.7')
  },
  push: {
    enabled: toBool(getOsEnv('PUSH_NOTIFICATIONS_ENABLED') || 'true'),
    expoAccessToken: getOsEnv('EXPO_ACCESS_TOKEN'),
    broadcastAllowedEmails: (getOsEnv('PUSH_BROADCAST_ALLOWED_EMAILS') || '')
      .split(',')
      .map(email => email.trim())
      .filter(Boolean)
  },
  elevenlabs: {
    apiKey: getOsEnv('ELEVENLABS_API_KEY'),
    voiceId: getOsEnv('ELEVENLABS_VOICE_ID') || 'EXAVITQu4vr4xnSDxMaL',
    modelId: getOsEnv('ELEVENLABS_MODEL_ID') || 'eleven_v3',
    stability: parseFloat(getOsEnv('ELEVENLABS_STABILITY') || '0.5'),
    speed: parseFloat(getOsEnv('ELEVENLABS_SPEED') || '1.0'),
    cacheTtlSeconds: toNumber(getOsEnv('ELEVENLABS_CACHE_TTL_SECONDS')) || 86400,
    optimizeStreamingLatency: toNumber(getOsEnv('ELEVENLABS_STREAMING_LATENCY')) || 0
  },
  storage: {
    provider: getOsEnv('STORAGE_PROVIDER') || 'supabase', // 'supabase', 'mongodb', or 's3'
    mongodb: {
      audioCollectionName: getOsEnv('STORAGE_MONGODB_COLLECTION') || 'audio_recordings',
      chatFilesCollectionName: getOsEnv('STORAGE_MONGODB_CHAT_FILES') || 'chat_files'
    },
    supabase: {
      chatBucket: getOsEnv('SUPABASE_STORAGE_CHAT_BUCKET') || 'chat-files',
      audioBucket: getOsEnv('SUPABASE_STORAGE_AUDIO_BUCKET') || 'audio-recordings',
      signedUrlExpiry: toNumber(getOsEnv('SUPABASE_STORAGE_SIGNED_URL_EXPIRY')) || 3600 // 1 hour
    },
    s3: {
      accessKeyId: getOsEnv('AWS_ACCESS_KEY_ID'),
      secretAccessKey: getOsEnv('AWS_SECRET_ACCESS_KEY'),
      region: getOsEnv('AWS_REGION') || 'us-east-1',
      bucket: getOsEnv('AWS_S3_BUCKET') || 'ielts-speaking-recordings',
      chatFilesBucket: getOsEnv('AWS_S3_CHAT_FILES_BUCKET') || 'ielts-chat-files',
      signedUrlExpiry: toNumber(getOsEnv('AWS_S3_SIGNED_URL_EXPIRY')) || 3600 // 1 hour
    },
    maxFileSizeMB: toNumber(getOsEnv('STORAGE_MAX_FILE_SIZE_MB')) || 50,
    allowedMimeTypes: (
      getOsEnv('STORAGE_ALLOWED_MIME_TYPES') ||
      'audio/mpeg,audio/wav,audio/webm,audio/mp4,audio/m4a,audio/x-m4a,audio/aac,audio/3gpp,image/jpeg,image/png,image/gif,video/mp4,video/quicktime'
    ).split(','),
    // Auto-delete chat files after 1 month (30 days)
    chatFileTTLDays: toNumber(getOsEnv('CHAT_FILE_TTL_DAYS')) || 30
  },
  rabbitmq: {
    enabled: toBool(getOsEnv('RABBITMQ_ENABLED')) || false,
    url: getOsEnv('RABBITMQ_URL') || 'amqp://localhost',
    exchange: getOsEnv('RABBITMQ_EXCHANGE') || 'default.exchange',
    queue: getOsEnv('RABBITMQ_QUEUE') || 'default.queue',
    routingKey: getOsEnv('RABBITMQ_ROUTING_KEY') || 'default.routing.key',
    prefetch: toNumber(getOsEnv('RABBITMQ_PREFETCH')) || 10,
    exchangeType: getOsEnv('RABBITMQ_EXCHANGE_TYPE') || 'direct',
    retries: toNumber(getOsEnv('RABBITMQ_RETRIES')) || 3,
    retryDelay: toNumber(getOsEnv('RABBITMQ_RETRY_DELAY')) || 5000,
    staleDuration: toNumber(getOsEnv('RABBITMQ_STALE_DURATION')) || 300000, // 5 minutes
    encryptionKey: getOsEnv('RABBITMQ_ENCRYPTION_KEY'),
    logLevel: getOsEnv('RABBITMQ_LOG_LEVEL') || 'info'
  },
  errors: {
    errorPrefix: getOsEnv('ERROR_CODE_PREFIX') || 'SERVICE',
    default: {
      errorCode: getOsEnv('DEFAULT_ERROR_CODE') || 'GLOBAL.UNMAPPED-ERROR',
      errorMessage: getOsEnv('DEFAULT_ERROR_MSG') || 'Something went wrong, please try after sometime',
      errorDescription:
        getOsEnv('DEFAULT_ERROR_DESC') || 'Error is not mapped in the service, please check log for further info'
    }
  },
  referral: {
    baseUrl: getOsEnv('REFERRAL_BASE_URL') || 'https://app.ielts-practice.com',
    deepLinkScheme: getOsEnv('APP_DEEP_LINK_SCHEME') || 'ieltsspeaking',
    iosStoreUrl: getOsEnv('APP_IOS_STORE_URL') || 'https://apps.apple.com/',
    androidStoreUrl: getOsEnv('APP_ANDROID_STORE_URL') || 'https://play.google.com/'
  }
};
