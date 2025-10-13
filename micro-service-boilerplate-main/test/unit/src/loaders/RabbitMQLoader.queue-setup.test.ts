import { IQueueConfig, RabbitMQService } from '@loaders/RabbitMQLoader';

// Mock all external dependencies
jest.mock('@env', () => ({
  env: {
    rabbitmq: {
      enabled: true,
      url: 'amqp://user:pass@localhost:5672',
      exchange: 'test-exchange',
      queue: 'test-queue',
      routingKey: 'test.routing.key',
      prefetch: 1,
      exchangeType: 'topic',
      retries: 3,
      retryDelay: 1000,
      staleDuration: 300000,
      encryptionKey: 'test-encryption-key',
      logLevel: 'debug'
    },
    constants: { aesIVBase64: 'test-iv' }
  }
}));

const isEmptyOrNullImpl = (value: any): boolean => {
  if (value && typeof value === 'object' && value.constructor?.name === 'RabbitMQService') {
    return false;
  }
  if (value === null || value === undefined || value === '') {
    return true;
  }
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  if (typeof value === 'number' && isNaN(value)) {
    return true;
  }
  if (!value) {
    return true;
  }
  return false;
};

jest.mock('@lib/env/helpers', () => ({
  constructLogMessage: jest.fn((filename: string, method: string) => `[${filename}:${method}] Test log message`),
  isEmptyOrNull: jest.fn((value: any) => isEmptyOrNullImpl(value)),
  encrypt: jest.fn((content: string) => `encrypted:${content}`),
  decrypt: jest.fn((content: string) => content.replace('encrypted:', ''))
}));

const helpersMock = require('@lib/env/helpers') as {
  constructLogMessage: jest.Mock<any, any>;
  isEmptyOrNull: jest.Mock<any, any>;
  encrypt: jest.Mock<any, any>;
  decrypt: jest.Mock<any, any>;
};

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

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234')
}));

// Advanced mock setup for queue/initialization testing
let mockChannel: any;
let mockConnection: any;

jest.mock('amqplib', () => ({
  connect: jest.fn()
}));

describe('RabbitMQService - Queue Setup and Initialization Tests (Lines 600-742)', () => {
  let service: RabbitMQService;
  let amqp: any;

  beforeEach(() => {
    jest.clearAllMocks();
    helpersMock.constructLogMessage.mockClear();
    helpersMock.constructLogMessage.mockImplementation((filename: string, method: string) => {
      return `[${filename}:${method}] Test log message`;
    });
    helpersMock.isEmptyOrNull.mockClear();
    helpersMock.isEmptyOrNull.mockImplementation((value: any) => isEmptyOrNullImpl(value));
    helpersMock.encrypt.mockClear();
    helpersMock.encrypt.mockImplementation((content: string) => `encrypted:${content}`);
    helpersMock.decrypt.mockClear();
    helpersMock.decrypt.mockImplementation((content: string) => content.replace('encrypted:', ''));
    service = new RabbitMQService();
    amqp = require('amqplib');

    // Setup comprehensive mock channel for queue operations
    mockChannel = {
      publish: jest.fn().mockResolvedValue(true),
      assertExchange: jest.fn().mockResolvedValue({}),
      assertQueue: jest.fn().mockResolvedValue({ queue: 'test-queue' }),
      bindQueue: jest.fn().mockResolvedValue({}),
      prefetch: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    };

    // Setup mock connection
    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    };

    amqp.connect.mockResolvedValue(mockConnection);
  });

  describe('Queue Setup and Configuration', () => {
    test('should setup queue with custom exchange and routing', async () => {
      const queueConfig: IQueueConfig = {
        queue: 'custom-queue',
        routingKey: 'custom.routing.key',
        processor: jest.fn(),
        enabled: true,
        exchange: 'custom-exchange',
        exchangeType: 'direct',
        prefetch: 5
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      // Verify exchange assertion with custom settings
      expect(mockChannel.assertExchange).toHaveBeenCalledWith('custom-exchange', 'direct', { durable: true });

      // Verify queue assertion
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('custom-queue', { durable: true });

      // Verify queue binding
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('custom-queue', 'custom-exchange', 'custom.routing.key');

      // Verify prefetch setting
      expect(mockChannel.prefetch).toHaveBeenCalledWith(5);

      // Verify consumer registration
      expect(mockChannel.consume).toHaveBeenCalledWith('custom-queue', expect.any(Function), { noAck: false });
    });

    test('should use default exchange when not specified in queue config', async () => {
      const queueConfig: IQueueConfig = {
        queue: 'default-queue',
        routingKey: 'default.key',
        processor: jest.fn(),
        enabled: true
        // No exchange specified - should use default
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      // Should use default exchange from env config
      expect(mockChannel.assertExchange).toHaveBeenCalledWith('test-exchange', 'topic', { durable: true });
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('default-queue', 'test-exchange', 'default.key');
    });

    test('should use default prefetch when not specified', async () => {
      const queueConfig: IQueueConfig = {
        queue: 'prefetch-test-queue',
        routingKey: 'prefetch.test',
        processor: jest.fn(),
        enabled: true
        // No prefetch specified - should use default
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      // Should use default prefetch from env config
      expect(mockChannel.prefetch).toHaveBeenCalledWith(1);
    });

    test('should skip disabled queues during setup', async () => {
      const enabledConfig: IQueueConfig = {
        queue: 'enabled-queue',
        routingKey: 'enabled.key',
        processor: jest.fn(),
        enabled: true
      };

      const disabledConfig: IQueueConfig = {
        queue: 'disabled-queue',
        routingKey: 'disabled.key',
        processor: jest.fn(),
        enabled: false
      };

      service.registerQueueProcessor(enabledConfig);
      service.registerQueueProcessor(disabledConfig);
      await service.connectToRabbitMQ();

      // Only enabled queue should be set up
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('enabled-queue', { durable: true });
      expect(mockChannel.assertQueue).not.toHaveBeenCalledWith('disabled-queue', { durable: true });
    });

    test('should handle queue setup errors and propagate them', async () => {
      const queueConfig: IQueueConfig = {
        queue: 'error-queue',
        routingKey: 'error.key',
        processor: jest.fn(),
        enabled: true
      };

      service['channels'].set(queueConfig.queue, mockChannel);
      mockChannel.assertExchange.mockRejectedValueOnce(new Error('assert failed'));

      await expect((service as any).setupQueue(queueConfig)).rejects.toThrow('assert failed');
    });

    test('should setup multiple queues in parallel', async () => {
      const queue1: IQueueConfig = {
        queue: 'queue-1',
        routingKey: 'queue1.key',
        processor: jest.fn(),
        enabled: true
      };

      const queue2: IQueueConfig = {
        queue: 'queue-2',
        routingKey: 'queue2.key',
        processor: jest.fn(),
        enabled: true
      };

      service.registerQueueProcessor(queue1);
      service.registerQueueProcessor(queue2);
      await service.connectToRabbitMQ();

      // Both queues should be set up
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('queue-1', { durable: true });
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('queue-2', { durable: true });
      expect(mockChannel.consume).toHaveBeenCalledTimes(2);
    });
  });

  describe('Service Initialization and Connection Management', () => {
    test('should initialize with no queues registered', async () => {
      // No queues registered - service should not attempt connection
      await service.connectToRabbitMQ();

      // Since no queues are registered, connection should not be attempted
      // This tests the early return logic in connectToRabbitMQ
      expect(mockChannel.assertQueue).not.toHaveBeenCalled();
      expect(mockChannel.consume).not.toHaveBeenCalled();
    });

    test('should handle connection creation with retry logic', async () => {
      let connectionAttempt = 0;
      amqp.connect.mockImplementation(() => {
        connectionAttempt++;
        if (connectionAttempt < 2) {
          throw new Error('Connection failed');
        }
        return Promise.resolve(mockConnection);
      });

      const queueConfig: IQueueConfig = {
        queue: 'retry-test-queue',
        routingKey: 'retry.test',
        processor: jest.fn(),
        enabled: true
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      expect(amqp.connect).toHaveBeenCalledTimes(2);
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('retry-test-queue', { durable: true });
    });

    test('should reuse existing channels for same queue', async () => {
      const queueConfig: IQueueConfig = {
        queue: 'reuse-test-queue',
        routingKey: 'reuse.test',
        processor: jest.fn(),
        enabled: true
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      // Call connectToRabbitMQ again
      await service.connectToRabbitMQ();

      // Should reuse the existing connection and channels
      expect(mockConnection.createChannel).toHaveBeenCalledTimes(1); // Only called once for initial setup
    });
  });

  describe('Lifecycle Event Handling', () => {
    test('should respond to connection and channel lifecycle events', async () => {
      const queueConfig: IQueueConfig = {
        queue: 'lifecycle-queue',
        routingKey: 'lifecycle.key',
        processor: jest.fn(),
        enabled: true
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      expect((service as any).channels.has('lifecycle-queue')).toBe(true);

      const channelErrorHandler = mockChannel.on.mock.calls.find(call => call[0] === 'error')[1];
      const channelCloseHandler = mockChannel.on.mock.calls.find(call => call[0] === 'close')[1];
      const connectionErrorHandler = mockConnection.on.mock.calls.find(call => call[0] === 'error')[1];
      const connectionCloseHandler = mockConnection.on.mock.calls.find(call => call[0] === 'close')[1];

      channelErrorHandler(new Error('channel error'));
      expect((service as any).channels.has('lifecycle-queue')).toBe(false);

      (service as any).channels.set('lifecycle-queue', mockChannel);
      channelCloseHandler();
      expect((service as any).channels.has('lifecycle-queue')).toBe(false);

      connectionErrorHandler(new Error('connection error'));

      (service as any).channels.set('lifecycle-queue', mockChannel);
      (service as any).publisherChannel = mockChannel;
      (service as any).connection = mockConnection;

      connectionCloseHandler();

      expect((service as any).connection).toBeUndefined();
      expect((service as any).channels.size).toBe(0);
      expect((service as any).publisherChannel).toBeUndefined();
    });
  });

  describe('Event Payload Validation', () => {
    test('should validate complete event payload structure', () => {
      const validPayload = {
        messageId: 'test-123',
        type: 'test',
        event: 'create',
        queue: 'test-queue',
        headers: {
          requestId: 'req-123',
          source: 'test-service',
          correlationId: 'corr-123',
          urc: 'test-urc'
        },
        timestamp: new Date().toISOString(),
        payload: { data: 'test' },
        metadata: {
          version: '1.0',
          priority: 'normal',
          tags: ['test']
        }
      };

      // Access private method through any casting
      const isValid = (service as any).isValidEventPayload(validPayload);
      expect(isValid).toBe(true);
    });

    test('should reject event payload with missing required fields', () => {
      const invalidPayload = {
        messageId: 'test-123',
        type: 'test',
        // Missing event field
        headers: {
          requestId: 'req-123',
          source: 'test-service',
          correlationId: 'corr-123',
          urc: 'test-urc'
        },
        timestamp: new Date().toISOString(),
        payload: { data: 'test' },
        metadata: {
          version: '1.0',
          priority: 'normal',
          tags: ['test']
        }
      };

      const isValid = (service as any).isValidEventPayload(invalidPayload);
      expect(isValid).toBe(false);
    });

    test('should reject event payload with incomplete headers', () => {
      const invalidPayload = {
        messageId: 'test-123',
        type: 'test',
        event: 'create',
        queue: 'test-queue',
        headers: {
          requestId: 'req-123',
          // Missing source and correlationId
          urc: 'test-urc'
        },
        timestamp: new Date().toISOString(),
        payload: { data: 'test' },
        metadata: {
          version: '1.0',
          priority: 'normal',
          tags: ['test']
        }
      };

      const isValid = (service as any).isValidEventPayload(invalidPayload);
      expect(isValid).toBe(false);
    });

    test('should reject event payload with incomplete metadata', () => {
      const invalidPayload = {
        messageId: 'test-123',
        type: 'test',
        event: 'create',
        queue: 'test-queue',
        headers: {
          requestId: 'req-123',
          source: 'test-service',
          correlationId: 'corr-123',
          urc: 'test-urc'
        },
        timestamp: new Date().toISOString(),
        payload: { data: 'test' },
        metadata: {
          version: '1.0'
          // Missing priority
        }
      };

      const isValid = (service as any).isValidEventPayload(invalidPayload);
      expect(isValid).toBe(false);
    });
  });

  describe('Pattern Matching Logic', () => {
    test('should match simple wildcard patterns', () => {
      const matchesPattern = (service as any).matchesPattern.bind(service);

      expect(matchesPattern('user.create', 'user.*')).toBe(true);
      expect(matchesPattern('user.update', 'user.*')).toBe(true);
      expect(matchesPattern('order.create', 'user.*')).toBe(false);
    });

    test('should match hash wildcard patterns', () => {
      const matchesPattern = (service as any).matchesPattern.bind(service);

      expect(matchesPattern('user.create.success', 'user.#')).toBe(true);
      expect(matchesPattern('user.update.failure', 'user.#')).toBe(true);
      expect(matchesPattern('order.create', 'user.#')).toBe(false);
    });

    test('should match RegExp patterns', () => {
      const matchesPattern = (service as any).matchesPattern.bind(service);

      expect(matchesPattern('user.create', /^user\..+/)).toBe(true);
      expect(matchesPattern('user.update', /^user\..+/)).toBe(true);
      expect(matchesPattern('order.create', /^user\..+/)).toBe(false);
    });

    test('should match exact patterns', () => {
      const matchesPattern = (service as any).matchesPattern.bind(service);

      expect(matchesPattern('user.create', 'user.create')).toBe(true);
      expect(matchesPattern('user.update', 'user.create')).toBe(false);
    });
  });

  describe('Publishing Channel Management', () => {
    test('should create publisher channel on first publish attempt', async () => {
      const publishData = {
        type: 'test',
        event: 'create',
        payload: { data: 'test' }
      };

      // Mock the publishMessage method call
      await service.publishMessage(publishData);

      // Should create a publisher channel
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.publish).toHaveBeenCalled();
    });

    test('should reuse existing publisher channel', async () => {
      const publishData = {
        type: 'test',
        event: 'create',
        payload: { data: 'test' }
      };

      // Publish twice
      await service.publishMessage(publishData);
      await service.publishMessage(publishData);

      // Should only create channel once but publish twice
      expect(mockConnection.createChannel).toHaveBeenCalledTimes(1);
      expect(mockChannel.publish).toHaveBeenCalledTimes(2);
    });
  });
});
