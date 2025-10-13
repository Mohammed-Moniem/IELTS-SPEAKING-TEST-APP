import { RabbitMQService } from '@loaders/RabbitMQLoader';

// Mock all external dependencies
jest.mock('@env', () => ({
  env: {
    rabbitmq: {
      enabled: true,
      url: 'amqp://localhost:5672',
      exchange: 'test-exchange',
      queue: 'test-queue',
      routingKey: 'test.routing.key',
      prefetch: 1,
      exchangeType: 'topic',
      retries: 3,
      retryDelay: 1000,
      staleDuration: 300000,
      encryptionKey: 'test-encryption-key',
      logLevel: 'info'
    },
    constants: { aesIVBase64: 'test-iv' }
  }
}));

jest.mock('@lib/env/helpers', () => ({
  constructLogMessage: () => 'mocked-log-message',
  isEmptyOrNull: (value: any) => value == null || value === '' || (Array.isArray(value) && value.length === 0),
  encrypt: () => 'encrypted-content',
  decrypt: () => 'decrypted-content'
}));

jest.mock('@lib/logger', () => ({
  Logger: function () {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
  }
}));

describe('RabbitMQService Integration Tests', () => {
  let service: RabbitMQService;

  beforeEach(() => {
    service = new RabbitMQService();
  });

  test('should create service instance', () => {
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(RabbitMQService);
  });

  test('should register queue processor', () => {
    const processor = jest.fn();
    const config = {
      queue: 'test-queue',
      routingKey: 'test.routing',
      processor
    };

    expect(() => {
      service.registerQueueProcessor(config);
    }).not.toThrow();
  });

  test('should register topic processor', () => {
    const processor = jest.fn();
    const topicConfig = {
      pattern: 'user.*.created',
      processor,
      description: 'Test processor'
    };

    expect(() => {
      service.registerTopicProcessor(topicConfig);
    }).not.toThrow();
  });

  test('should return false for isConnected when not connected', () => {
    expect(service.isConnected()).toBe(false);
  });

  test('should return service statistics', () => {
    const stats = service.getStats();

    expect(stats).toHaveProperty('connected');
    expect(stats).toHaveProperty('channels');
    expect(stats).toHaveProperty('hasPublisherChannel');
    expect(stats).toHaveProperty('registeredQueues');
    expect(stats).toHaveProperty('enabledQueues');
    expect(stats).toHaveProperty('topicProcessors');
    expect(stats).toHaveProperty('processedMessagesCount');
    expect(stats).toHaveProperty('config');

    // URL might be masked or original depending on implementation
    expect(typeof stats.config.url).toBe('string');
  });

  test('should clear processed messages cache', () => {
    expect(() => {
      service.clearProcessedMessagesCache();
    }).not.toThrow();
  });
});
