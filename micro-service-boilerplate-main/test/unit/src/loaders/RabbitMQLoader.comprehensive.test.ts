import { RabbitMQService, connectToRabbitMQ, getRabbitMQService, isConnected } from '@loaders/RabbitMQLoader';

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

const resetHelpers = (): void => {
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

// Mock amqplib with proper setup
let mockChannel: any;
let mockConnection: any;

jest.mock('amqplib', () => ({
  connect: jest.fn().mockImplementation(() => {
    mockChannel = {
      publish: jest.fn().mockResolvedValue(true),
      assertExchange: jest.fn().mockResolvedValue({}),
      assertQueue: jest.fn().mockResolvedValue({ queue: 'test-queue' }),
      bindQueue: jest.fn().mockResolvedValue({}),
      prefetch: jest.fn().mockResolvedValue({}),
      consume: jest.fn().mockResolvedValue({}),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn().mockResolvedValue({}),
      on: jest.fn()
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue({}),
      on: jest.fn()
    };

    return Promise.resolve(mockConnection);
  })
}));

describe('RabbitMQService Comprehensive Tests', () => {
  let service: RabbitMQService;

  beforeEach(() => {
    jest.clearAllMocks();
    resetHelpers();
    service = new RabbitMQService();
  });

  describe('Service Statistics', () => {
    test('should return comprehensive statistics with enabled queues', () => {
      // Setup - register multiple queues
      service.registerQueueProcessor({
        queue: 'enabled-queue',
        routingKey: 'enabled.key',
        processor: jest.fn(),
        enabled: true
      });

      service.registerQueueProcessor({
        queue: 'disabled-queue',
        routingKey: 'disabled.key',
        processor: jest.fn(),
        enabled: false
      });

      service.registerTopicProcessor({
        pattern: 'user.*',
        processor: jest.fn(),
        description: 'User events'
      });

      // Test
      const stats = service.getStats();

      // Verify
      expect(stats.connected).toBe(false);
      expect(stats.channels).toBe(0);
      expect(stats.hasPublisherChannel).toBe(false);
      expect(stats.registeredQueues).toContain('enabled-queue');
      expect(stats.registeredQueues).toContain('disabled-queue');
      expect(stats.enabledQueues).toContain('enabled-queue');
      expect(stats.enabledQueues).not.toContain('disabled-queue');
      expect(stats.topicProcessors).toBe(1);
      expect(stats.processedMessagesCount).toBe(0);
    });

    test('should handle URL masking in getStats', () => {
      // Test
      const stats = service.getStats();

      // Verify URL is masked (it keeps the protocol prefix)
      expect(stats.config.url).toBe('amqp://***@localhost:5672');
      expect(stats.config.enabled).toBe(true);
      expect(stats.config.exchange).toBe('test-exchange');
      expect(stats.config.logLevel).toBe('debug');
    });
  });

  describe('Cache Management', () => {
    test('should clear processed messages cache', () => {
      // Setup - simulate processed messages
      service['processedMessages'].add('msg-1');
      service['processedMessages'].add('msg-2');
      service['processedMessages'].add('msg-3');

      expect(service['processedMessages'].size).toBe(3);

      // Test
      service.clearProcessedMessagesCache();

      // Verify
      expect(service['processedMessages'].size).toBe(0);
    });
  });

  describe('Publish Message Behavior', () => {
    test('should throw when required publish fields are missing', async () => {
      await expect(
        service.publishMessage({ type: '', event: '', payload: {} } as any)
      ).rejects.toThrow('Missing required fields: type and event are mandatory');
    });

    test('should encrypt payload when requested', async () => {
      const publisherChannel = {
        assertExchange: jest.fn().mockResolvedValue({}),
        publish: jest.fn().mockReturnValue(true)
      } as any;
      const channelSpy = jest
        .spyOn(service as any, 'createChannelWithRetry')
        .mockResolvedValue(publisherChannel);

      const publishData = {
        type: 'notification',
        event: 'created',
        payload: { id: '123' }
      };

      await service.publishMessage(publishData, { encrypt: true });

      expect(helpersMock.encrypt).toHaveBeenCalled();
      const publishCall = publisherChannel.publish.mock.calls[0];
      expect(publishCall[2].toString()).toContain('encrypted:');

      channelSpy.mockRestore();
    });

    test('should warn when channel publish returns false', async () => {
      const publisherChannel = {
        assertExchange: jest.fn().mockResolvedValue({}),
        publish: jest.fn().mockReturnValue(true)
      } as any;
      const channelSpy = jest
        .spyOn(service as any, 'createChannelWithRetry')
        .mockResolvedValue(publisherChannel);

      const publishData = {
        type: 'notification',
        event: 'initial',
        payload: { id: '123' }
      };

      await service.publishMessage(publishData);
      helpersMock.isEmptyOrNull.mockClear();
      publisherChannel.publish.mockReturnValueOnce(false);

      const retryPayload = {
        type: 'notification',
        event: 'retry',
        payload: { id: '456' }
      };

      await service.publishMessage(retryPayload);
      expect(helpersMock.isEmptyOrNull).toHaveBeenCalledWith(false);

      channelSpy.mockRestore();
    });

    test('should propagate errors when publish fails', async () => {
      const publisherChannel = {
        assertExchange: jest.fn().mockResolvedValue({}),
        publish: jest.fn()
      } as any;
      publisherChannel.publish.mockReturnValueOnce(true);
      const channelSpy = jest
        .spyOn(service as any, 'createChannelWithRetry')
        .mockResolvedValue(publisherChannel);

      const publishData = {
        type: 'notification',
        event: 'success',
        payload: { id: '999' }
      };

      await service.publishMessage(publishData);
      publisherChannel.publish.mockImplementationOnce(() => {
        throw new Error('publish failure');
      });

      const failingPayload = {
        type: 'notification',
        event: 'error',
        payload: { id: '1000' }
      };

      await expect(service.publishMessage(failingPayload)).rejects.toThrow('publish failure');

      expect(channelSpy).toHaveBeenCalledTimes(1);
      channelSpy.mockRestore();
    });
  });

  describe('Log Level Filtering', () => {
    test('should respect log level configuration', () => {
      // Test shouldLog method indirectly through logWithLevel
      const service = new RabbitMQService();

      // Access private method for testing
      const shouldLog = (service as any).shouldLog.bind(service);

      // With logLevel 'debug', all levels should be logged
      expect(shouldLog('debug')).toBe(true);
      expect(shouldLog('info')).toBe(true);
      expect(shouldLog('warn')).toBe(true);
      expect(shouldLog('error')).toBe(true);
    });
  });

  describe('Multiple Queue Registration', () => {
    test('should register multiple queues at once', () => {
      const configs = [
        {
          queue: 'queue1',
          routingKey: 'key1',
          processor: jest.fn()
        },
        {
          queue: 'queue2',
          routingKey: 'key2',
          processor: jest.fn()
        }
      ];

      service.registerMultipleQueues(configs);

      const stats = service.getStats();
      expect(stats.registeredQueues).toContain('queue1');
      expect(stats.registeredQueues).toContain('queue2');
    });

    test('should register default processor using environment defaults', () => {
      const processor = jest.fn();

      service.registerDefaultProcessor(processor);

      const queueConfigs = (service as any).queueConfigs;
      const defaultConfig = queueConfigs.get('test-queue');

      expect(defaultConfig).toBeDefined();
      expect(defaultConfig?.routingKey).toBe('test.routing.key');
      expect(defaultConfig?.processor).toBe(processor);
      expect(defaultConfig?.prefetch).toBe(1);
    });

    test('should build event payload with sensible defaults', () => {
      const payload = (service as any).buildEventPayload(
        {
          type: 'audit',
          event: 'created',
          payload: { id: 123 },
          correlationId: 'corr-123'
        },
        {
          routingKey: 'audit.created',
          exchange: 'audit-exchange',
          source: 'unit-test'
        },
        { urc: 'test-urc' }
      );

      expect(payload.type).toBe('audit');
      expect(payload.event).toBe('created');
      expect(payload.headers.correlationId).toBe('corr-123');
      expect(payload.headers.source).toBe('unit-test');
      expect(payload.queue).toBe('');
    });
  });
});

describe('Legacy Export Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetHelpers();
  });

  test('connectToRabbitMQ should create service instance if none exists', async () => {
    const connectSpy = jest.spyOn(RabbitMQService.prototype, 'connectToRabbitMQ').mockResolvedValue();

    await connectToRabbitMQ();

    expect(connectSpy).toHaveBeenCalled();
  });

  test('isConnected should return false when no service instance', () => {
    expect(isConnected()).toBe(false);
  });

  test('getRabbitMQService should create instance if none exists', () => {
    const service = getRabbitMQService();
    expect(service).toBeInstanceOf(RabbitMQService);
  });

  test('getRabbitMQService should return existing instance', () => {
    const firstCall = getRabbitMQService();
    const secondCall = getRabbitMQService();
    expect(firstCall).toBe(secondCall);
  });
});

describe('Error Handling and Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetHelpers();
  });

  test('should handle validation config with missing URL', () => {
    // Create a service with minimal access to test private methods
    const serviceInstance = new RabbitMQService();

    // Mock the config to have missing values
    (serviceInstance as any).config = {
      enabled: true,
      url: '',
      exchange: '',
      logLevel: 'info'
    };

    // Test validation
    expect(() => {
      (serviceInstance as any).validateConfig();
    }).toThrow('RabbitMQ configuration is missing required fields.');
  });

  test('should handle disabled RabbitMQ configuration', () => {
    const serviceInstance = new RabbitMQService();

    // Mock the config to be disabled (false is not empty/null)
    (serviceInstance as any).config = {
      enabled: null, // This will be considered "empty" by isEmptyOrNull
      url: 'amqp://localhost',
      exchange: 'test-exchange',
      logLevel: 'info'
    };

    const result = (serviceInstance as any).validateConfig();
    expect(result).toBe(false);
  });

  test('should execute graceful shutdown handlers without exiting process', async () => {
    const handlers: Record<string, any> = {};
    const processOnSpy = jest
      .spyOn(process, 'on')
      .mockImplementation(((event: string, handler: any) => {
        handlers[event] = handler;
        return process;
      }) as any);

    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(((() => {
        throw new Error('exit:0');
      }) as any) as never);

    const shutdownService = new RabbitMQService();

    (shutdownService as any).setupGracefulShutdown();

    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    const sigintHandler = handlers['SIGINT'];
    expect(typeof sigintHandler).toBe('function');

    const channel = { close: jest.fn().mockResolvedValue(undefined) } as any;
    const connection = { close: jest.fn().mockResolvedValue(undefined) } as any;

    (shutdownService as any).channels.set('shutdown-queue', channel);
    (shutdownService as any).publisherChannel = channel;
    (shutdownService as any).connection = connection;

    await expect(sigintHandler()).rejects.toThrow('exit:0');

    expect(channel.close).toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalled();
    expect((shutdownService as any).channels.size).toBe(0);
    expect((shutdownService as any).publisherChannel).toBeUndefined();

    exitSpy.mockRestore();
    processOnSpy.mockRestore();
  });
});
