import { env } from '@env';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage, decrypt, encrypt, isEmptyOrNull } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import * as amqp from 'amqplib';
import { Service } from 'typedi';
import { v4 as uuidv4 } from 'uuid';

// Node.js global declarations
declare var process: {
  exit(code?: number): never;
  on(event: string, listener: (...args: any[]) => void): any;
};

// Type definitions for flexible message processing
export interface IMessageProcessor {
  (event: IEventPayload, context: IMessageContext, headers: IRequestHeaders): Promise<void>;
}

export interface IMessageContext {
  messageId: string;
  routingKey: string;
  exchange: string;
  queue: string;
  timestamp: Date;
  originalMessage?: amqp.ConsumeMessage;
}

export interface IQueueConfig {
  queue: string;
  routingKey: string;
  processor: IMessageProcessor;
  prefetch?: number;
  exchangeType?: string;
  exchange?: string;
  enabled?: boolean;
}

export interface ITopicProcessor {
  pattern: string | RegExp;
  processor: IMessageProcessor;
  description?: string;
}

// Simplified publish interface - service will build the full IEventPayload structure
export interface IPublishOptions {
  routingKey?: string;
  exchange?: string;
  encrypt?: boolean;
  persistent?: boolean;
  headers?: any;
  priority?: string;
  tags?: string[];
  version?: string;
  source?: string;
}

// Minimal payload for publishing - service will enhance it to IEventPayload
export interface IPublishPayload {
  type: string;
  event: string;
  payload: any;
  source?: string;
  correlationId?: string;
  priority?: string;
  tags?: string[];
  version?: string;
}

export interface IEventPayload {
  messageId: string;
  type: string;
  event: string;
  queue: string;
  headers: {
    requestId: string;
    source: string;
    correlationId: string;
    urc: string;
  };
  timestamp: string;
  payload: any;
  metadata: {
    version: string;
    priority: string;
    tags: string[];
  };
}

@Service()
export class RabbitMQService {
  private log = new Logger('RabbitMQService');
  private connection: any = undefined; // amqp.Connection type has issues, using any for now
  private channels = new Map<string, amqp.Channel>();
  private processedMessages = new Set<string>();
  private queueConfigs = new Map<string, IQueueConfig>();
  private topicProcessors: ITopicProcessor[] = [];
  private publisherChannel: amqp.Channel | undefined = undefined;

  private readonly config = env.rabbitmq;

  constructor() {
    const headers: IRequestHeaders = { urc: 'rabbitmq-init' };
    const logMessage = constructLogMessage('RabbitMQService', 'constructor', headers);
    this.log.info(`${logMessage} :: RabbitMQ Service initialized`);
  }

  /**
   * Register a processor for a specific queue
   * This allows you to define which function handles messages from which queue
   */
  public registerQueueProcessor(config: IQueueConfig): void {
    const headers: IRequestHeaders = { urc: 'rabbitmq-register' };
    const logMessage = constructLogMessage('RabbitMQService', 'registerQueueProcessor', headers);

    this.log.info(`${logMessage} :: Registering queue processor`, {
      queue: config.queue,
      routingKey: config.routingKey,
      exchange: config.exchange || this.config.exchange,
      enabled: config.enabled !== false
    });

    this.queueConfigs.set(config.queue, {
      ...config,
      enabled: config.enabled !== false // Default to enabled
    });
  }

  /**
   * Register a topic-based processor (pattern matching)
   * This allows routing based on routing key patterns (e.g., "user.*.created", "notification.#")
   */
  public registerTopicProcessor(processor: ITopicProcessor): void {
    const headers: IRequestHeaders = { urc: 'rabbitmq-topic' };
    const logMessage = constructLogMessage('RabbitMQService', 'registerTopicProcessor', headers);

    this.log.info(`${logMessage} :: Registering topic processor`, {
      pattern: processor.pattern.toString(),
      description: processor.description
    });

    this.topicProcessors.push(processor);
  }

  /**
   * Register a simple callback processor for the default queue (backward compatibility)
   */
  public registerDefaultProcessor(processor: IMessageProcessor): void {
    const headers: IRequestHeaders = { urc: 'rabbitmq-default' };
    const logMessage = constructLogMessage('RabbitMQService', 'registerDefaultProcessor', headers);

    this.log.info(`${logMessage} :: Registering default processor`);

    this.registerQueueProcessor({
      queue: this.config.queue,
      routingKey: this.config.routingKey,
      processor,
      prefetch: this.config.prefetch,
      exchangeType: this.config.exchangeType
    });
  }

  /**
   * Register multiple queue configurations at once
   */
  public registerMultipleQueues(configs: IQueueConfig[]): void {
    const headers: IRequestHeaders = { urc: 'rabbitmq-multi-register' };
    const logMessage = constructLogMessage('RabbitMQService', 'registerMultipleQueues', headers);

    this.log.info(`${logMessage} :: Registering multiple queue processors`, {
      count: configs.length,
      queues: configs.map(c => c.queue)
    });

    configs.forEach(config => {
      this.registerQueueProcessor(config);
    });
  }

  /**
   * Build a complete IEventPayload from minimal publish data
   */
  private buildEventPayload(
    publishPayload: IPublishPayload,
    options: IPublishOptions,
    headers: IRequestHeaders
  ): IEventPayload {
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();

    return {
      messageId,
      type: publishPayload.type,
      event: publishPayload.event,
      queue: '', // Will be set based on routing
      headers: {
        requestId: messageId,
        source: publishPayload.source || options.source || 'RabbitMQService',
        correlationId: publishPayload.correlationId || headers.urc || messageId,
        urc: headers.urc || messageId
      },
      timestamp,
      payload: publishPayload.payload,
      metadata: {
        version: publishPayload.version || options.version || '1.0.0',
        priority: publishPayload.priority || options.priority || 'normal',
        tags: publishPayload.tags || options.tags || []
      }
    };
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex >= currentLevelIndex;
  }

  private logWithLevel(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (isEmptyOrNull(this.shouldLog(level))) return;

    switch (level) {
      case 'debug':
        this.log.debug(message, data);
        break;
      case 'info':
        this.log.info(message, data);
        break;
      case 'warn':
        this.log.warn(message, data);
        break;
      case 'error':
        this.log.error(message, data);
        break;
    }
  }

  private validateConfig(): boolean {
    const headers: IRequestHeaders = { urc: 'rabbitmq-config' };
    const logMessage = constructLogMessage('RabbitMQService', 'validateConfig', headers);
    this.logWithLevel('debug', `${logMessage} :: Starting configuration validation`);

    if (isEmptyOrNull(this.config.enabled)) {
      this.logWithLevel('info', `${logMessage} :: RabbitMQ is disabled, skipping configuration validation`);
      return false;
    }

    if (isEmptyOrNull(this.config.url) || isEmptyOrNull(this.config.exchange)) {
      const missingConfig = {
        url: !this.config.url,
        exchange: !this.config.exchange
      };
      this.logWithLevel('error', `${logMessage} :: RabbitMQ configuration is missing`, { missingConfig });
      throw new Error('RabbitMQ configuration is missing required fields.');
    }

    this.logWithLevel('info', `${logMessage} :: Configuration validation successful`, {
      url: this.config.url.replace(/\/\/.*@/, '//***@'),
      exchange: this.config.exchange,
      registeredQueues: Array.from(this.queueConfigs.keys()),
      topicProcessors: this.topicProcessors.length
    });
    return true;
  }

  private async createChannelWithRetry(channelId: string, maxRetries: number, delay: number): Promise<amqp.Channel> {
    const headers: IRequestHeaders = { urc: `rabbitmq-channel-${channelId}` };
    const logMessage = constructLogMessage('RabbitMQService', 'createChannelWithRetry', headers);
    this.logWithLevel('debug', `${logMessage} :: Starting channel creation with retry logic`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logWithLevel('debug', `${logMessage} :: Attempt ${attempt} of ${maxRetries}`);

        if (isEmptyOrNull(this.connection)) {
          this.logWithLevel('info', `${logMessage} :: Creating new RabbitMQ connection`);
          this.connection = await amqp.connect(this.config.url);
          this.logWithLevel('info', `${logMessage} :: Successfully connected to RabbitMQ`);

          this.connection.on('error', err => {
            this.logWithLevel('error', `${logMessage} :: Connection error`, { error: err.message });
          });

          this.connection.on('close', () => {
            this.logWithLevel('warn', `${logMessage} :: Connection closed`);
            this.connection = undefined;
            this.channels.clear();
            this.publisherChannel = undefined;
          });
        }

        const newChannel = await this.connection.createChannel();
        this.logWithLevel('info', `${logMessage} :: Successfully created channel on attempt ${attempt}`);

        newChannel.on('error', err => {
          this.logWithLevel('error', `${logMessage} :: Channel error`, { error: err.message, channelId });
          this.channels.delete(channelId);
          if (channelId === 'publisher') {
            this.publisherChannel = undefined;
          }
        });

        newChannel.on('close', () => {
          this.logWithLevel('warn', `${logMessage} :: Channel closed`, { channelId });
          this.channels.delete(channelId);
          if (channelId === 'publisher') {
            this.publisherChannel = undefined;
          }
        });

        return newChannel;
      } catch (error: any) {
        this.logWithLevel('error', `${logMessage} :: Failed to create channel on attempt ${attempt}`, {
          error: error.message,
          stack: error.stack
        });

        if (attempt < maxRetries) {
          this.logWithLevel('info', `${logMessage} :: Retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.logWithLevel('error', `${logMessage} :: All retry attempts exhausted`);
          throw error;
        }
      }
    }
    throw new Error('Failed to create channel after all retries');
  }

  private async handleMessage(msg: amqp.ConsumeMessage | null, queueConfig: IQueueConfig): Promise<void> {
    if (isEmptyOrNull(msg)) {
      this.logWithLevel('warn', 'RabbitMQService :: handleMessage :: Received null message');
      return;
    }

    const messageId = msg!.properties.messageId || uuidv4();
    const headers: IRequestHeaders = { urc: messageId };
    const logMessage = constructLogMessage('RabbitMQService', 'handleMessage', headers);

    this.logWithLevel('debug', `${logMessage} :: Processing message`, {
      messageId,
      routingKey: msg!.fields.routingKey,
      exchange: msg!.fields.exchange,
      queue: queueConfig.queue
    });

    // Check for duplicate messages
    if (this.processedMessages.has(messageId)) {
      this.logWithLevel('warn', `${logMessage} :: Duplicate message detected and ignored`);
      const channel = this.channels.get(queueConfig.queue);
      if (!isEmptyOrNull(channel)) channel!.ack(msg!);
      return;
    }

    try {
      let eventPayload: IEventPayload;

      // Decrypt message if encryption key is provided
      if (!isEmptyOrNull(this.config.encryptionKey)) {
        this.logWithLevel('debug', `${logMessage} :: Decrypting message content`);
        try {
          const decryptedContent = decrypt(
            msg!.content.toString('utf8'),
            this.config.encryptionKey,
            env.constants.aesIVBase64
          );
          eventPayload = JSON.parse(decryptedContent);
          this.logWithLevel('debug', `${logMessage} :: Successfully decrypted and parsed message`);
        } catch (decryptError: any) {
          this.logWithLevel('error', `${logMessage} :: Failed to decrypt message`, { error: decryptError.message });
          const channel = this.channels.get(queueConfig.queue);
          if (!isEmptyOrNull(channel)) channel!.nack(msg!, false, false);
          return;
        }
      } else {
        // Parse message directly if no encryption
        this.logWithLevel('debug', `${logMessage} :: Parsing unencrypted message content`);
        try {
          eventPayload = JSON.parse(msg!.content.toString('utf8'));
          this.logWithLevel('debug', `${logMessage} :: Successfully parsed message`);
        } catch (parseError: any) {
          this.logWithLevel('error', `${logMessage} :: Failed to parse message`, { error: parseError.message });
          const channel = this.channels.get(queueConfig.queue);
          if (!isEmptyOrNull(channel)) channel!.nack(msg!, false, false);
          return;
        }
      }

      // Validate event payload structure
      if (isEmptyOrNull(this.isValidEventPayload(eventPayload))) {
        this.logWithLevel('error', `${logMessage} :: Invalid event payload structure`, { eventPayload });
        const channel = this.channels.get(queueConfig.queue);
        if (!isEmptyOrNull(channel)) channel!.nack(msg!, false, false);
        return;
      }

      // Check for stale messages using the structured timestamp
      if (!isEmptyOrNull(eventPayload.timestamp)) {
        const eventTimestamp = new Date(eventPayload.timestamp);
        const messageAge = Date.now() - eventTimestamp.getTime();

        this.logWithLevel('debug', `${logMessage} :: Checking message age`, {
          eventTimestamp: eventTimestamp.toISOString(),
          messageAge,
          staleDuration: this.config.staleDuration
        });

        if (messageAge > this.config.staleDuration) {
          this.logWithLevel('warn', `${logMessage} :: Stale message detected and ignored`, {
            messageAge,
            staleDuration: this.config.staleDuration
          });
          const channel = this.channels.get(queueConfig.queue);
          if (!isEmptyOrNull(channel)) channel!.ack(msg!);
          return;
        }
      }

      this.logWithLevel('info', `${logMessage} :: Processing valid event payload`, {
        eventType: eventPayload.type,
        event: eventPayload.event,
        queue: queueConfig.queue,
        routingKey: msg!.fields.routingKey,
        messageId: eventPayload.messageId
      });

      // Create message context
      const context: IMessageContext = {
        messageId: eventPayload.messageId,
        routingKey: msg!.fields.routingKey,
        exchange: msg!.fields.exchange,
        queue: queueConfig.queue,
        timestamp: new Date(eventPayload.timestamp),
        originalMessage: msg!
      };

      // Process the event using the registered processor
      await this.processEvent(eventPayload, context, headers, queueConfig);

      // Mark message as processed
      this.processedMessages.add(messageId);
      this.logWithLevel('debug', `${logMessage} :: Marked message as processed`);

      // Acknowledge the message
      const channel = this.channels.get(queueConfig.queue);
      if (!isEmptyOrNull(channel)) {
        channel!.ack(msg!);
        this.logWithLevel('debug', `${logMessage} :: Message acknowledged successfully`);
      }
    } catch (eventProcessingError: any) {
      this.logWithLevel('error', `${logMessage} :: Error processing event`, {
        error: eventProcessingError.message,
        stack: eventProcessingError.stack,
        queue: queueConfig.queue,
        routingKey: msg!.fields.routingKey
      });

      // Reject the message without requeuing
      const channel = this.channels.get(queueConfig.queue);
      if (!isEmptyOrNull(channel)) {
        channel!.nack(msg!, false, false);
        this.logWithLevel('debug', `${logMessage} :: Message rejected (not requeued)`);
      }
    }
  }

  private isValidEventPayload(eventPayload: any): eventPayload is IEventPayload {
    if (isEmptyOrNull(eventPayload)) return false;

    const required = ['messageId', 'type', 'event', 'headers', 'timestamp', 'payload', 'metadata'];

    for (const field of required) {
      if (isEmptyOrNull(eventPayload[field])) {
        return false;
      }
    }

    // Validate headers structure
    if (
      isEmptyOrNull(eventPayload.headers) ||
      isEmptyOrNull(eventPayload.headers.urc) ||
      isEmptyOrNull(eventPayload.headers.source) ||
      isEmptyOrNull(eventPayload.headers.correlationId)
    ) {
      return false;
    }

    // Validate metadata structure
    if (
      isEmptyOrNull(eventPayload.metadata) ||
      isEmptyOrNull(eventPayload.metadata.version) ||
      isEmptyOrNull(eventPayload.metadata.priority)
    ) {
      return false;
    }

    return true;
  }

  private async processEvent(
    eventPayload: IEventPayload,
    context: IMessageContext,
    headers: IRequestHeaders,
    queueConfig: IQueueConfig
  ): Promise<void> {
    const logMessage = constructLogMessage('RabbitMQService', 'processEvent', headers);

    try {
      // First try queue-specific processor
      if (!isEmptyOrNull(queueConfig.processor)) {
        this.logWithLevel('debug', `${logMessage} :: Using queue-specific processor`, {
          queue: queueConfig.queue
        });
        await queueConfig.processor(eventPayload, context, headers);
        return;
      }

      // Then try topic-based processors
      for (const topicProcessor of this.topicProcessors) {
        const matches = this.matchesPattern(context.routingKey, topicProcessor.pattern);
        if (!isEmptyOrNull(matches)) {
          this.logWithLevel('debug', `${logMessage} :: Using topic processor`, {
            pattern: topicProcessor.pattern.toString(),
            routingKey: context.routingKey,
            description: topicProcessor.description
          });
          await topicProcessor.processor(eventPayload, context, headers);
          return;
        }
      }

      // Default processing (just log)
      this.logWithLevel('info', `${logMessage} :: No specific processor found, using default logging`, {
        eventType: eventPayload.type,
        event: eventPayload.event,
        routingKey: context.routingKey,
        queue: context.queue
      });
    } catch (error: any) {
      this.logWithLevel('error', `${logMessage} :: Error in event processing`, {
        error: error.message,
        stack: error.stack,
        routingKey: context.routingKey,
        queue: context.queue
      });
      throw error;
    }
  }

  private matchesPattern(routingKey: string, pattern: string | RegExp): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(routingKey);
    }

    // Convert RabbitMQ pattern to regex (*, #)
    const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]*').replace(/#/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(routingKey);
  }

  private async setupQueue(queueConfig: IQueueConfig): Promise<void> {
    const headers: IRequestHeaders = { urc: `rabbitmq-setup-${queueConfig.queue}` };
    const logMessage = constructLogMessage('RabbitMQService', 'setupQueue', headers);

    if (isEmptyOrNull(queueConfig.enabled)) {
      this.logWithLevel('info', `${logMessage} :: Queue setup skipped (disabled)`, { queue: queueConfig.queue });
      return;
    }

    this.logWithLevel('info', `${logMessage} :: Setting up queue`, { queue: queueConfig.queue });

    try {
      const channelId = queueConfig.queue;
      let channel = this.channels.get(channelId);

      if (isEmptyOrNull(channel)) {
        this.logWithLevel('debug', `${logMessage} :: Creating new channel for queue`);
        channel = await this.createChannelWithRetry(channelId, this.config.retries, this.config.retryDelay);
        this.channels.set(channelId, channel);
      }

      const exchange = queueConfig.exchange || this.config.exchange;
      const exchangeType = queueConfig.exchangeType || this.config.exchangeType;

      this.logWithLevel('debug', `${logMessage} :: Asserting exchange`, { exchange, exchangeType });
      await channel.assertExchange(exchange, exchangeType, { durable: true });
      this.logWithLevel('info', `${logMessage} :: Exchange asserted successfully`);

      this.logWithLevel('debug', `${logMessage} :: Asserting queue`, { queue: queueConfig.queue });
      await channel.assertQueue(queueConfig.queue, { durable: true });
      this.logWithLevel('info', `${logMessage} :: Queue asserted successfully`);

      this.logWithLevel('debug', `${logMessage} :: Binding queue to exchange`, {
        queue: queueConfig.queue,
        exchange,
        routingKey: queueConfig.routingKey
      });
      await channel.bindQueue(queueConfig.queue, exchange, queueConfig.routingKey);
      this.logWithLevel('info', `${logMessage} :: Queue bound to exchange successfully`);

      const prefetch = queueConfig.prefetch || this.config.prefetch;
      this.logWithLevel('debug', `${logMessage} :: Setting prefetch limit`, { prefetch });
      channel.prefetch(prefetch);
      this.logWithLevel('info', `${logMessage} :: Prefetch limit set`);

      this.consumeMessages(queueConfig, channel);
      this.logWithLevel('info', `${logMessage} :: Queue setup completed successfully`);
    } catch (error: any) {
      this.logWithLevel('error', `${logMessage} :: Failed to setup queue`, {
        error: error.message,
        stack: error.stack,
        queue: queueConfig.queue
      });
      throw error;
    }
  }

  private consumeMessages(queueConfig: IQueueConfig, channel: amqp.Channel): void {
    const headers: IRequestHeaders = { urc: `rabbitmq-consumer-${queueConfig.queue}` };
    const logMessage = constructLogMessage('RabbitMQService', 'consumeMessages', headers);
    this.logWithLevel('info', `${logMessage} :: Starting message consumption`);

    channel.consume(
      queueConfig.queue,
      async msg => {
        await this.handleMessage(msg, queueConfig);
      },
      { noAck: false }
    );

    this.logWithLevel('info', `${logMessage} :: Message consumer registered`);
  }

  private async setupRabbitMQ(): Promise<void> {
    const headers: IRequestHeaders = { urc: 'rabbitmq-setup' };
    const logMessage = constructLogMessage('RabbitMQService', 'setupRabbitMQ', headers);
    this.logWithLevel('info', `${logMessage} :: Starting RabbitMQ setup`);

    if (isEmptyOrNull(this.validateConfig())) {
      this.logWithLevel('info', `${logMessage} :: RabbitMQ setup skipped (disabled)`);
      return;
    }

    try {
      // Setup all registered queues
      const enabledConfigs = Array.from(this.queueConfigs.values()).filter(config => config.enabled !== false);

      if (isEmptyOrNull(enabledConfigs)) {
        this.logWithLevel('warn', `${logMessage} :: No queues registered or all queues disabled`);
        return;
      }

      this.logWithLevel('info', `${logMessage} :: Setting up ${enabledConfigs.length} enabled queues`);

      const setupPromises = enabledConfigs.map(config => this.setupQueue(config));
      await Promise.all(setupPromises);

      this.logWithLevel('info', `${logMessage} :: All queues setup completed successfully`);
    } catch (error: any) {
      this.logWithLevel('error', `${logMessage} :: Failed to setup RabbitMQ`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  private setupGracefulShutdown(): void {
    const headers: IRequestHeaders = { urc: 'rabbitmq-shutdown' };
    const logMessage = constructLogMessage('RabbitMQService', 'setupGracefulShutdown', headers);
    this.logWithLevel('debug', `${logMessage} :: Setting up graceful shutdown handlers`);

    const shutdown = async (signal: string) => {
      const shutdownHeaders: IRequestHeaders = { urc: `rabbitmq-shutdown-${signal}` };
      const shutdownMessage = constructLogMessage('RabbitMQService', 'shutdown', shutdownHeaders);
      this.logWithLevel('info', `${shutdownMessage} :: Received ${signal}, initiating graceful shutdown`);

      try {
        // Close all channels
        for (const [channelId, channel] of Array.from(this.channels.entries())) {
          this.logWithLevel('debug', `${shutdownMessage} :: Closing channel`, { channelId });
          await channel.close();
        }
        this.channels.clear();

        if (!isEmptyOrNull(this.publisherChannel)) {
          this.logWithLevel('debug', `${shutdownMessage} :: Closing publisher channel`);
          await this.publisherChannel.close();
          this.publisherChannel = undefined;
        }

        this.logWithLevel('info', `${shutdownMessage} :: All RabbitMQ channels closed`);

        if (!isEmptyOrNull(this.connection)) {
          this.logWithLevel('debug', `${shutdownMessage} :: Closing RabbitMQ connection`);
          await this.connection.close();
          this.logWithLevel('info', `${shutdownMessage} :: RabbitMQ connection closed`);
        }

        this.logWithLevel('info', `${shutdownMessage} :: Graceful shutdown completed`);
        process.exit(0);
      } catch (error: any) {
        this.logWithLevel('error', `${shutdownMessage} :: Error during shutdown`, {
          error: error.message
        });
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    this.logWithLevel('debug', `${logMessage} :: Graceful shutdown handlers registered`);
  }

  /**
   * Initialize and connect to RabbitMQ
   */
  public async connectToRabbitMQ(): Promise<void> {
    const headers: IRequestHeaders = { urc: 'rabbitmq-connect' };
    const logMessage = constructLogMessage('RabbitMQService', 'connectToRabbitMQ', headers);

    if (isEmptyOrNull(this.config.enabled)) {
      this.logWithLevel('info', `${logMessage} :: RabbitMQ is disabled, skipping connection`);
      return;
    }

    try {
      this.logWithLevel('info', `${logMessage} :: Initiating RabbitMQ connection`);
      await this.setupRabbitMQ();
      this.setupGracefulShutdown();
      this.logWithLevel('info', `${logMessage} :: RabbitMQ connection established successfully`);
    } catch (error: any) {
      this.logWithLevel('error', `${logMessage} :: Failed to connect to RabbitMQ`, {
        error: error.message,
        stack: error.stack
      });

      if (!isEmptyOrNull(this.config.enabled)) {
        this.logWithLevel('info', `${logMessage} :: Retrying connection in ${this.config.retryDelay}ms`);
        setTimeout(() => this.connectToRabbitMQ(), this.config.retryDelay);
      }
    }
  }

  /**
   * Check if the service is connected to RabbitMQ
   */
  public isConnected(): boolean {
    return !!(this.connection && (this.channels.size > 0 || this.publisherChannel));
  }

  /**
   * Publish a message to RabbitMQ
   */
  /**
   * Publish a message to RabbitMQ using simplified payload - service builds full IEventPayload
   */
  public async publishMessage(publishPayload: IPublishPayload, options: IPublishOptions = {}): Promise<void> {
    const headers: IRequestHeaders = { urc: uuidv4() };
    const logMessage = constructLogMessage('RabbitMQService', 'publishMessage', headers);

    // Validate required fields
    if (isEmptyOrNull(publishPayload.type) || isEmptyOrNull(publishPayload.event)) {
      this.logWithLevel('error', `${logMessage} :: Missing required fields in publish payload`, {
        type: publishPayload.type,
        event: publishPayload.event
      });
      throw new Error('Missing required fields: type and event are mandatory');
    }

    const exchange = options.exchange || this.config.exchange;
    const routingKey = options.routingKey || this.config.routingKey;

    // Get or create a publisher channel
    if (isEmptyOrNull(this.publisherChannel)) {
      this.logWithLevel('debug', `${logMessage} :: Creating publisher channel`);
      this.publisherChannel = await this.createChannelWithRetry(
        'publisher',
        this.config.retries,
        this.config.retryDelay
      );

      // Assert exchange for publishing
      await this.publisherChannel!.assertExchange(exchange, this.config.exchangeType, { durable: true });
    }

    try {
      this.logWithLevel('debug', `${logMessage} :: Publishing message`, {
        exchange,
        routingKey,
        type: publishPayload.type,
        event: publishPayload.event
      });

      // Build complete IEventPayload from minimal IPublishPayload
      const eventPayload = this.buildEventPayload(publishPayload, options, headers);
      eventPayload.queue = routingKey; // Set queue based on routing key

      this.logWithLevel('debug', `${logMessage} :: Built event payload`, {
        messageId: eventPayload.messageId,
        type: eventPayload.type,
        event: eventPayload.event,
        timestamp: eventPayload.timestamp
      });

      let content = JSON.stringify(eventPayload);

      if (!isEmptyOrNull(options?.encrypt) && !isEmptyOrNull(this.config.encryptionKey)) {
        this.logWithLevel('debug', `${logMessage} :: Encrypting message content`);
        content = encrypt(content, this.config.encryptionKey, env.constants.aesIVBase64);
      }

      const publishOptions = {
        messageId: eventPayload.messageId,
        timestamp: Date.now(),
        persistent: options.persistent !== false,
        headers: {
          ...options.headers,
          type: eventPayload.type,
          event: eventPayload.event,
          source: eventPayload.headers.source
        }
      };

      const result = this.publisherChannel!.publish(exchange, routingKey, Buffer.from(content, 'utf8'), publishOptions);

      if (!isEmptyOrNull(result)) {
        this.logWithLevel('info', `${logMessage} :: Event payload published successfully`, {
          messageId: eventPayload.messageId,
          type: eventPayload.type,
          event: eventPayload.event,
          exchange,
          routingKey
        });
      } else {
        this.logWithLevel('warn', `${logMessage} :: Message publish returned false - channel may be blocked`);
      }
    } catch (error: any) {
      this.logWithLevel('error', `${logMessage} :: Failed to publish message`, {
        error: error.message,
        exchange,
        routingKey,
        type: publishPayload.type,
        event: publishPayload.event
      });
      throw error;
    }
  }

  /**
   * Get service statistics
   */
  public getStats(): any {
    return {
      connected: this.isConnected(),
      channels: this.channels.size,
      hasPublisherChannel: !!this.publisherChannel,
      registeredQueues: Array.from(this.queueConfigs.keys()),
      enabledQueues: Array.from(this.queueConfigs.values())
        .filter(c => c.enabled !== false)
        .map(c => c.queue),
      topicProcessors: this.topicProcessors.length,
      processedMessagesCount: this.processedMessages.size,
      config: {
        enabled: this.config.enabled,
        url: this.config.url ? this.config.url.replace(/\/\/.*@/, '//***@') : 'not-set',
        exchange: this.config.exchange,
        logLevel: this.config.logLevel
      }
    };
  }

  /**
   * Clear processed messages cache (useful for testing or memory management)
   */
  public clearProcessedMessagesCache(): void {
    const headers: IRequestHeaders = { urc: 'cache-clear' };
    const logMessage = constructLogMessage('RabbitMQService', 'clearProcessedMessagesCache', headers);

    const previousSize = this.processedMessages.size;
    this.processedMessages.clear();

    this.logWithLevel('info', `${logMessage} :: Cleared processed messages cache`, {
      previousSize,
      currentSize: this.processedMessages.size
    });
  }
}

// Export for legacy compatibility and loader pattern
let rabbitMQServiceInstance: RabbitMQService | undefined;

export const connectToRabbitMQ = async (): Promise<void> => {
  if (isEmptyOrNull(rabbitMQServiceInstance)) {
    rabbitMQServiceInstance = new RabbitMQService();
  }
  await rabbitMQServiceInstance.connectToRabbitMQ();
};

export const isConnected = (): boolean => {
  return rabbitMQServiceInstance ? rabbitMQServiceInstance.isConnected() : false;
};

export const getRabbitMQService = (): RabbitMQService => {
  if (isEmptyOrNull(rabbitMQServiceInstance)) {
    rabbitMQServiceInstance = new RabbitMQService();
  }
  return rabbitMQServiceInstance;
};
