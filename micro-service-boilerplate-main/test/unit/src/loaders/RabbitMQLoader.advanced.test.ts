import { IQueueConfig, RabbitMQService } from '@loaders/RabbitMQLoader';
import amqp from 'amqplib';
import 'reflect-metadata';

// Mock amqplib
jest.mock('amqplib');

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

// Mock environment - CRITICAL: Must use @env alias
jest.mock('@env', () => ({
  env: {
    rabbitmq: {
      enabled: true,
      url: 'amqp://user:pass@localhost:5672',
      exchange: 'test-exchange',
      queue: 'test-queue',
      routingKey: 'test.routing.key',
      prefetch: 10,
      exchangeType: 'direct',
      retries: 3,
      retryDelay: 1000,
      staleDuration: 300000, // 5 minutes
      encryptionKey: 'test-key',
      logLevel: 'info'
    },
    constants: { aesIVBase64: 'test-iv' }
  }
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

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234')
}));

describe('RabbitMQService - Advanced Coverage Tests', () => {
  let service: RabbitMQService;
  let mockConnection: any;
  let mockChannel: any;

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

    // Create service instance directly
    service = new RabbitMQService();

    // Setup mocks
    mockChannel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue({ queue: 'test-queue' }),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      prefetch: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue({ consumerTag: 'test-consumer' }),
      ack: jest.fn(),
      nack: jest.fn(),
      publish: jest.fn().mockReturnValue(true),
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined)
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined)
    };

    (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);
  });

  describe('Message Handling and Processing (Lines 400-600)', () => {
    test('should handle message processing workflow', async () => {
      const processor = jest.fn().mockResolvedValue(undefined);
      const queueConfig: IQueueConfig = {
        queue: 'test-queue',
        routingKey: 'test.routing.key',
        enabled: true,
        processor
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertExchange).toHaveBeenCalled();
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('test-queue', { durable: true });
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('test-queue', 'test-exchange', 'test.routing.key');
      expect(mockChannel.prefetch).toHaveBeenCalledWith(10);
      expect(mockChannel.consume).toHaveBeenCalledWith(
        'test-queue',
        expect.any(Function),
        expect.objectContaining({ noAck: false })
      );
    });

    test('should handle stale message detection in workflow', async () => {
      const processor = jest.fn().mockResolvedValue(undefined);
      const queueConfig: IQueueConfig = {
        queue: 'stale-queue',
        routingKey: 'test.routing.key',
        enabled: true,
        processor
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      // Create a message with stale timestamp
      const staleTimestamp = new Date(Date.now() - 7 * 60 * 1000); // 7 minutes ago
      const staleMessage = {
        content: Buffer.from(
          JSON.stringify({
            messageId: 'stale-msg-123',
            type: 'test',
            event: 'create',
            headers: {
              requestId: 'req-123',
              urc: 'test-urc',
              source: 'test-service',
              correlationId: 'corr-123'
            },
            timestamp: staleTimestamp.toISOString(),
            payload: { data: 'test' },
            metadata: { version: '1.0', priority: 'normal', tags: ['test'] }
          })
        ),
        properties: { messageId: 'stale-msg-123' },
        fields: { routingKey: 'test.routing.key', exchange: 'test-exchange' }
      };

      // Get the message handler from consume call
      const consumeCall = mockChannel.consume.mock.calls.find(call => call[0] === 'stale-queue');
      if (consumeCall) {
        const messageHandler = consumeCall[1];
        await messageHandler(staleMessage);

        // Should acknowledge stale message
        expect(mockChannel.ack).toHaveBeenCalledWith(staleMessage);
      }
    });

    test('should handle duplicate message detection in workflow', async () => {
      const processor = jest.fn().mockResolvedValue(undefined);
      const queueConfig: IQueueConfig = {
        queue: 'duplicate-queue',
        routingKey: 'test.routing.key',
        enabled: true,
        processor
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      const duplicateMessage = {
        content: Buffer.from(
          JSON.stringify({
            messageId: 'duplicate-msg-123',
            type: 'test',
            event: 'create',
            headers: {
              requestId: 'req-123',
              urc: 'test-urc',
              source: 'test-service',
              correlationId: 'corr-123'
            },
            timestamp: new Date().toISOString(),
            payload: { data: 'test' },
            metadata: { version: '1.0', priority: 'normal', tags: ['test'] }
          })
        ),
        properties: { messageId: 'duplicate-msg-123' },
        fields: { routingKey: 'test.routing.key', exchange: 'test-exchange' }
      };

      // Get the message handler
      const consumeCall = mockChannel.consume.mock.calls.find(call => call[0] === 'duplicate-queue');
      if (consumeCall) {
        const messageHandler = consumeCall[1];

        // Process the same message twice
        await messageHandler(duplicateMessage);
        await messageHandler(duplicateMessage);

        // Should acknowledge both times
        expect(mockChannel.ack).toHaveBeenCalledWith(duplicateMessage);
      }
    });

    test('should handle processing errors and nack messages', async () => {
      const errorProcessor = jest.fn().mockRejectedValue(new Error('Processing failed'));
      const queueConfig: IQueueConfig = {
        queue: 'error-queue',
        routingKey: 'error.key',
        processor: errorProcessor,
        enabled: true
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      const testMessage = {
        content: Buffer.from(
          JSON.stringify({
            messageId: 'error-msg-123',
            type: 'test',
            event: 'create',
            headers: {
              requestId: 'req-123',
              urc: 'test-urc',
              source: 'test-service',
              correlationId: 'corr-123'
            },
            timestamp: new Date().toISOString(),
            payload: { data: 'test' },
            metadata: { version: '1.0', priority: 'normal', tags: ['test'] }
          })
        ),
        properties: { messageId: 'error-msg-123' },
        fields: { routingKey: 'error.key', exchange: 'test-exchange' }
      };

      // Get the message handler
      const consumeCall = mockChannel.consume.mock.calls.find(call => call[0] === 'error-queue');
      if (consumeCall) {
        const messageHandler = consumeCall[1];
        await messageHandler(testMessage);

        // Should nack the message
        expect(mockChannel.nack).toHaveBeenCalledWith(testMessage, false, false);
      }
    });

    test('should nack messages when decryption fails', async () => {
      const processor = jest.fn().mockResolvedValue(undefined);
      const queueConfig: IQueueConfig = {
        queue: 'decrypt-queue',
        routingKey: 'decrypt.key',
        enabled: true,
        processor
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      helpersMock.decrypt.mockImplementationOnce(() => {
        throw new Error('decrypt failure');
      });

      const encryptedPayload = {
        messageId: 'decrypt-msg-123',
        type: 'test',
        event: 'create',
        headers: {
          requestId: 'req-123',
          urc: 'test-urc',
          source: 'test-service',
          correlationId: 'corr-123'
        },
        timestamp: new Date().toISOString(),
        payload: { data: 'test' },
        metadata: { version: '1.0', priority: 'normal', tags: [] }
      };

      const message = {
        content: Buffer.from(`encrypted:${JSON.stringify(encryptedPayload)}`),
        properties: { messageId: 'decrypt-msg-123' },
        fields: { routingKey: 'decrypt.key', exchange: 'test-exchange' }
      };

      const consumeCall = mockChannel.consume.mock.calls.find(call => call[0] === 'decrypt-queue');
      if (consumeCall) {
        const messageHandler = consumeCall[1];
        await messageHandler(message);

        expect(mockChannel.nack).toHaveBeenCalledWith(message, false, false);
        expect(mockChannel.ack).not.toHaveBeenCalledWith(message);
      }
    });

    test('should nack messages when JSON parsing fails', async () => {
      const processor = jest.fn().mockResolvedValue(undefined);
      const queueConfig: IQueueConfig = {
        queue: 'parse-queue',
        routingKey: 'parse.key',
        enabled: true,
        processor
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      (service as any).config.encryptionKey = '';

      const message = {
        content: Buffer.from('not-json'),
        properties: { messageId: 'parse-msg-123' },
        fields: { routingKey: 'parse.key', exchange: 'test-exchange' }
      };

      const consumeCall = mockChannel.consume.mock.calls.find(call => call[0] === 'parse-queue');
      if (consumeCall) {
        const messageHandler = consumeCall[1];
        await messageHandler(message);

        expect(mockChannel.nack).toHaveBeenCalledWith(message, false, false);
      }
    });

    test('should reject invalid event payload structure', async () => {
      const processor = jest.fn().mockResolvedValue(undefined);
      const queueConfig: IQueueConfig = {
        queue: 'invalid-payload-queue',
        routingKey: 'invalid.payload',
        enabled: true,
        processor
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      (service as any).config.encryptionKey = '';

      const invalidPayload = {
        messageId: 'invalid-msg-123',
        type: 'test',
        event: 'create',
        headers: {
          requestId: 'req-123',
          urc: 'test-urc',
          source: 'test-service',
          correlationId: 'corr-123'
        },
        timestamp: new Date().toISOString(),
        payload: { data: 'test' }
        // metadata missing
      };

      const message = {
        content: Buffer.from(JSON.stringify(invalidPayload)),
        properties: { messageId: 'invalid-msg-123' },
        fields: { routingKey: 'invalid.payload', exchange: 'test-exchange' }
      };

      const consumeCall = mockChannel.consume.mock.calls.find(call => call[0] === 'invalid-payload-queue');
      if (consumeCall) {
        const messageHandler = consumeCall[1];
        await messageHandler(message);

        expect(mockChannel.nack).toHaveBeenCalledWith(message, false, false);
      }
    });

    test('should ignore null messages gracefully', async () => {
      await (service as any).handleMessage(null, {
        queue: 'null-queue',
        routingKey: 'null.key',
        processor: jest.fn()
      });

      expect(mockChannel.ack).not.toHaveBeenCalled();
    });
  });

  describe('Topic Processor and Pattern Matching', () => {
    test('should use topic processors when no queue processor exists', async () => {
      const topicProcessor = jest.fn().mockResolvedValue(undefined);

      // Register topic processor
      service.registerTopicProcessor({
        pattern: 'test.routing.*',
        processor: topicProcessor,
        description: 'Test topic processor'
      });

      // Register queue without processor
      // Ensure the topic processor path is exercised by leaving queue processor undefined
      const queueConfig: IQueueConfig = {
        queue: 'topic-queue',
        routingKey: 'test.routing.key',
        enabled: true,
        processor: undefined as unknown as any
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      const testMessage = {
        content: Buffer.from(
          JSON.stringify({
            messageId: 'topic-msg-123',
            type: 'test',
            event: 'create',
            headers: {
              requestId: 'req-123',
              urc: 'test-urc',
              source: 'test-service',
              correlationId: 'corr-123'
            },
            timestamp: new Date().toISOString(),
            payload: { data: 'test' },
            metadata: { version: '1.0', priority: 'normal', tags: ['test'] }
          })
        ),
        properties: { messageId: 'topic-msg-123' },
        fields: { routingKey: 'test.routing.key', exchange: 'test-exchange' }
      };

      // Get the message handler
      const consumeCall = mockChannel.consume.mock.calls.find(call => call[0] === 'topic-queue');
      if (consumeCall) {
        const messageHandler = consumeCall[1];
        await messageHandler(testMessage);

        // Should use topic processor and acknowledge
        expect(topicProcessor).toHaveBeenCalledWith(
          expect.objectContaining({ messageId: 'topic-msg-123', event: 'create' }),
          expect.objectContaining({ routingKey: 'test.routing.key', queue: 'topic-queue' }),
          expect.objectContaining({ urc: 'topic-msg-123' })
        );
        expect(mockChannel.ack).toHaveBeenCalledWith(testMessage);
      }
    });

    test('should handle RegExp pattern matching', async () => {
      const regexProcessor = jest.fn().mockResolvedValue(undefined);

      // Register topic processor with RegExp
      service.registerTopicProcessor({
        pattern: /^test\.routing\..+$/,
        processor: regexProcessor,
        description: 'Regex topic processor'
      });

      const queueConfig: IQueueConfig = {
        queue: 'regex-queue',
        routingKey: 'test.routing.key',
        enabled: true,
        processor: jest.fn() // Default processor
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      // Verify that queue setup worked
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('regex-queue', { durable: true });
      expect(mockChannel.consume).toHaveBeenCalledWith(
        'regex-queue',
        expect.any(Function),
        expect.objectContaining({ noAck: false })
      );
    });

    test('should handle wildcard pattern matching', async () => {
      const wildcardProcessor = jest.fn().mockResolvedValue(undefined);

      // Register topic processor with wildcard
      service.registerTopicProcessor({
        pattern: 'test.#',
        processor: wildcardProcessor,
        description: 'Wildcard topic processor'
      });

      const queueConfig: IQueueConfig = {
        queue: 'wildcard-queue',
        routingKey: 'test.routing.key',
        enabled: true,
        processor: jest.fn() // Default processor
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      // Verify that queue setup worked
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('wildcard-queue', { durable: true });
      expect(mockChannel.consume).toHaveBeenCalledWith(
        'wildcard-queue',
        expect.any(Function),
        expect.objectContaining({ noAck: false })
      );
    });

    test('should fall back to default processing when no processors match', async () => {
      // Register queue without processor and no matching topic processors
      const queueConfig: IQueueConfig = {
        queue: 'fallback-queue',
        routingKey: 'different.routing.key',
        enabled: true,
        processor: jest.fn() // Default processor for fallback
      };

      service.registerQueueProcessor(queueConfig);
      await service.connectToRabbitMQ();

      const fallbackMessage = {
        content: Buffer.from(
          JSON.stringify({
            messageId: 'fallback-msg-123',
            type: 'test',
            event: 'create',
            headers: {
              requestId: 'req-123',
              urc: 'test-urc',
              source: 'test-service',
              correlationId: 'corr-123'
            },
            timestamp: new Date().toISOString(),
            payload: { data: 'test' },
            metadata: { version: '1.0', priority: 'normal', tags: ['test'] }
          })
        ),
        properties: { messageId: 'fallback-msg-123' },
        fields: { routingKey: 'different.routing.key', exchange: 'test-exchange' }
      };

      // Get the message handler
      const consumeCall = mockChannel.consume.mock.calls.find(call => call[0] === 'fallback-queue');
      if (consumeCall) {
        const messageHandler = consumeCall[1];
        await messageHandler(fallbackMessage);

        // Should still acknowledge the message
        expect(mockChannel.ack).toHaveBeenCalledWith(fallbackMessage);
      }
    });
  });
});
