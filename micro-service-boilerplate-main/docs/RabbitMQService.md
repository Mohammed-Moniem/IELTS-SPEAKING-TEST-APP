# RabbitMQ Service - Class-Based Architecture

This document provides comprehensive documentation for the new class-based `RabbitMQService` that supports callback processors, multi-channel consumption, topic-based routing, and message publishing with standardized event payloads.

## Overview

The `RabbitMQService` is a TypeScript class that provides a complete RabbitMQ integration with the following features:

- **Standardized Event Payloads**: All events use the `IEventPayload` interface for consistency
- **Simplified Publishing**: Use minimal `IPublishPayload` - service builds full event payload internally
- **Callback-based message processing**: Register custom functions to process messages
- **Multi-channel support**: Consume from multiple queues simultaneously
- **Topic-based routing**: Route messages to processors based on routing key patterns
- **Message publishing**: Send messages to RabbitMQ with encryption support
- **Comprehensive logging**: Configurable logging with different levels
- **Error handling**: Robust error handling with retries and graceful degradation
- **Graceful shutdown**: Proper cleanup on application termination

## Architecture

### Event Payload Structure

All events use the standardized `IEventPayload` interface:

```typescript
interface IEventPayload {
  messageId: string;           // Unique message identifier
  type: string;               // Message type (e.g., 'chat.message', 'user.created')
  event: string;              // Event name (e.g., 'created', 'updated', 'deleted')
  queue: string;              // Target queue name
  headers: IRequestHeaders;   // Request headers for logging context
  timestamp: Date;            // Event timestamp
  payload: any;               // Actual message data
  metadata?: {                // Optional metadata
    source?: string;          // Source service
    version?: string;         // Schema version
    traceId?: string;         // Distributed tracing ID
    retryCount?: number;      // Retry attempt count
    [key: string]: any;       // Additional metadata
  };
}
```

### Simplified Publishing Interface

For publishing, use the minimal `IPublishPayload` interface:

```typescript
interface IPublishPayload {
  type: string;               // Message type (e.g., 'chat.message')
  event: string;              // Event name (e.g., 'created')
  queue: string;              // Target queue name
  payload: any;               // Actual message data
  metadata?: {                // Optional metadata
    source?: string;
    version?: string;
    traceId?: string;
    [key: string]: any;
  };
}
```

The service automatically builds the full `IEventPayload` with generated messageId, timestamp, and request headers.

### Key Interfaces

```typescript
// Message processor function signature
interface IMessageProcessor {
  (event: IEventPayload, context: IMessageContext, headers: IRequestHeaders): Promise<void>;
}

// Message context passed to processors
interface IMessageContext {
  messageId: string;
  routingKey: string;
  exchange: string;
  queue: string;
  timestamp: Date;
  originalMessage?: ConsumeMessage;
}

// Queue configuration
interface IQueueConfig {
  queue: string;
  routingKey: string;
  processor: IMessageProcessor;
  prefetch?: number;
  exchangeType?: string;
  exchange?: string;
  enabled?: boolean;
}

// Topic-based processor configuration
interface ITopicProcessor {
  pattern: string | RegExp;
  processor: IMessageProcessor;
  description?: string;
}
```

## Installation

Before using the service, install the required dependencies:

```bash
npm install amqplib @types/amqplib
```

## Configuration

The service uses environment variables from `src/env.ts`. Ensure your `.env` file includes:

```env
# RabbitMQ Configuration
RABBITMQ_ENABLED=true
RABBITMQ_URL=amqp://username:password@localhost:5672
RABBITMQ_EXCHANGE=your-exchange
RABBITMQ_QUEUE=your-default-queue
RABBITMQ_ROUTING_KEY=your-routing-key
RABBITMQ_PREFETCH=1
RABBITMQ_EXCHANGE_TYPE=topic
RABBITMQ_RETRIES=3
RABBITMQ_RETRY_DELAY=5000
RABBITMQ_STALE_DURATION=300000
RABBITMQ_ENCRYPTION_KEY=your-encryption-key
RABBITMQ_LOG_LEVEL=info
```

## Usage Examples

### 1. Basic Setup with Single Processor

```typescript
import { Container } from 'typedi';
import { RabbitMQService, IMessageProcessor, IEventPayload } from '../loaders/RabbitMQService';

// Define your message processor using IEventPayload
const myProcessor: IMessageProcessor = async (event: IEventPayload, context, headers) => {
  console.log('Processing message:', {
    type: event.type,
    eventName: event.event,
    messageId: event.messageId,
    timestamp: event.timestamp
  });
  console.log('Routing key:', context.routingKey);
  
  // Your business logic here
  if (event.type === 'user' && event.event === 'created') {
    // Handle user creation
    console.log('User data:', event.payload);
  }
};

// Setup and connect
const rabbitMQService = Container.get(RabbitMQService);
rabbitMQService.registerDefaultProcessor(myProcessor);
await rabbitMQService.connectToRabbitMQ();
```

### 2. Complete Message Processor Examples

```typescript
import { Container } from 'typedi';
import { IRequestHeaders } from '../api/Interface/IRequestHeaders';
import { IMessageContext, IMessageProcessor, IEventPayload, RabbitMQService } from '../loaders/RabbitMQService';

// User events processor using IEventPayload
const userProcessor: IMessageProcessor = async (event: IEventPayload, context: IMessageContext, headers: IRequestHeaders) => {
  console.log(`Processing user event: ${event.type}.${event.event}`, {
    messageId: event.messageId,
    userId: event.payload.userId,
    queue: context.queue,
    routingKey: context.routingKey,
    timestamp: event.timestamp
  });
  
  switch (event.event) {
    case 'created':
      // Handle user creation
      console.log('New user created:', event.payload);
      break;
    case 'updated':
      // Handle user update
      console.log('User updated:', event.payload);
      break;
    case 'deleted':
      // Handle user deletion
      console.log('User deleted:', event.payload);
      break;
    default:
      console.log('Unknown user event:', event.event);
  }
  
  // Your business logic here
  if (event.type === 'user.created') {
    // Handle user creation
    console.log('New user created:', event.userId);
  } else if (event.type === 'user.updated') {
    // Handle user update
    console.log('User updated:', event.userId);
  }
};

// Notification events processor
const notificationProcessor: IMessageProcessor = async (event: any, context: IMessageContext, headers: IRequestHeaders) => {
  console.log(`Processing notification event: ${event.type}`, {
    recipientId: event.recipientId,
    message: event.message,
    queue: context.queue,
    routingKey: context.routingKey
  });
  
  // Send notification logic here
  if (event.type === 'notification.email') {
    console.log('Sending email notification to:', event.recipientId);
  } else if (event.type === 'notification.sms') {
    console.log('Sending SMS notification to:', event.recipientId);
  }
};

// Order events processor
const orderProcessor: IMessageProcessor = async (event: any, context: IMessageContext, headers: IRequestHeaders) => {
  console.log(`Processing order event: ${event.type}`, {
    orderId: event.orderId,
    status: event.status,
    queue: context.queue,
    routingKey: context.routingKey
  });
  
  // Order processing logic here
  if (event.type === 'order.created') {
    console.log('New order created:', event.orderId);
  } else if (event.type === 'order.completed') {
    console.log('Order completed:', event.orderId);
  }
};

// Generic processor for unmatched messages
const defaultProcessor: IMessageProcessor = async (event: any, context: IMessageContext, headers: IRequestHeaders) => {
  console.log(`Processing unmatched event: ${event.type}`, {
    routingKey: context.routingKey,
    queue: context.queue,
    timestamp: context.timestamp
  });
};
```

### 3. Multi-Queue Configuration

```typescript
// Example 1: Register processors for specific queues
export async function setupMultiQueueConsumers(): Promise<void> {
  const rabbitMQService = Container.get(RabbitMQService);
  
  // Register multiple queue configurations
  rabbitMQService.registerMultipleQueues([
    {
      queue: 'user-events',
      routingKey: 'user.*',
      processor: userProcessor,
      prefetch: 10,
      enabled: true
    },
    {
      queue: 'notification-events', 
      routingKey: 'notification.*',
      processor: notificationProcessor,
      prefetch: 5,
      enabled: true
    },
    {
      queue: 'order-events',
      routingKey: 'order.*', 
      processor: orderProcessor,
      prefetch: 15,
      enabled: true
    }
  ]);
  
  console.log('Multi-queue consumers registered');
}
```

### 4. Topic-Based Routing

```typescript
// Example 2: Register topic-based processors (pattern matching)
export async function setupTopicProcessors(): Promise<void> {
  const rabbitMQService = Container.get(RabbitMQService);
  
  // Register topic processors for pattern-based routing
  rabbitMQService.registerTopicProcessor({
    pattern: 'user.*.created',
    processor: async (event, context, headers) => {
      console.log('New user creation detected:', event.userId);
      // Special handling for all user creation events regardless of source
    },
    description: 'Handle all user creation events'
  });
  
  rabbitMQService.registerTopicProcessor({
    pattern: /^notification\.(email|sms)$/,
    processor: async (event, context, headers) => {
      console.log('Priority notification detected:', event.type);
      // Handle priority notifications with regex pattern
    },
    description: 'Handle priority email/SMS notifications'
  });
  
  rabbitMQService.registerTopicProcessor({
    pattern: 'order.#', // RabbitMQ wildcard for all order events
    processor: async (event, context, headers) => {
      console.log('Order event detected:', event.type);
      // Handle all order-related events
    },
    description: 'Handle all order events'
  });
  
  console.log('Topic processors registered');
}
```

### 5. Publishing Messages

```typescript
// Example 4: Publishing messages with standardized IEventPayload
export async function publishMessages(): Promise<void> {
  const rabbitMQService = Container.get(RabbitMQService);
  
  // Publish a user creation event using simplified IPublishPayload
  await rabbitMQService.publishMessage({
    type: 'user',
    event: 'created',
    queue: 'user.events',
    payload: {
      userId: '12345',
      email: 'user@example.com',
      name: 'John Doe'
    },
    metadata: {
      source: 'user-service',
      version: '1.0.0'
    }
  });
  
  // Publish a notification event
  await rabbitMQService.publishMessage({
    type: 'notification',
    event: 'email.send',
    queue: 'notification.events',
    payload: {
      recipientId: '12345',
      message: 'Welcome to our platform!',
      template: 'welcome_email'
    },
    metadata: {
      source: 'notification-service'
    }
  });
  
  // Publish an order event
  await rabbitMQService.publishMessage({
    type: 'order',
    event: 'created',
    queue: 'order.events',
    payload: {
      orderId: 'ORD-001',
      customerId: '12345',
      amount: 99.99,
      items: ['item1', 'item2']
    }
  });
  
  console.log('Messages published successfully');
}
}
```

### 6. Service Health and Statistics

```typescript
// Example 5: Service statistics and health check
export async function checkServiceHealth(): Promise<void> {
  const rabbitMQService = Container.get(RabbitMQService);
  
  const stats = rabbitMQService.getStats();
  console.log('RabbitMQ Service Stats:', JSON.stringify(stats, null, 2));
  
  const isConnected = rabbitMQService.isConnected();
  console.log('Connection status:', isConnected ? 'Connected' : 'Disconnected');
}
```

### 7. Complete Setup Example

```typescript
// Complete setup example
export async function setupRabbitMQService(): Promise<void> {
  try {
    console.log('Setting up RabbitMQ Service...');
    
    // Setup different processor types
    await setupMultiQueueConsumers();
    await setupTopicProcessors();
    await setupDefaultProcessor();
    
    // Get the service and connect
    const rabbitMQService = Container.get(RabbitMQService);
    await rabbitMQService.connectToRabbitMQ();
    
    // Check health
    await checkServiceHealth();
    
    console.log('RabbitMQ Service setup complete!');
    
    // Optional: Publish some test messages
    // await publishMessages();
    
  } catch (error) {
    console.error('Failed to setup RabbitMQ Service:', error);
  }
}

// Setup for backward compatibility (single processor)
export async function setupDefaultProcessor(): Promise<void> {
  const rabbitMQService = Container.get(RabbitMQService);
  
  // Register a default processor for backward compatibility
  rabbitMQService.registerDefaultProcessor(defaultProcessor);
  
  console.log('Default processor registered');
}

// Usage in your application loader or main app
export const initializeRabbitMQ = setupRabbitMQService;
```

## Advanced Features

### Message Encryption

Messages can be automatically encrypted/decrypted using the configured encryption key:

```typescript
// Encrypted publishing
await rabbitMQService.publishMessage(sensitiveData, { encrypt: true });

// The service automatically decrypts incoming messages if encryption key is configured
```

### Duplicate Message Detection

The service tracks processed messages to prevent duplicate processing:

```typescript
// Automatic duplicate detection based on message ID
// Duplicate messages are acknowledged but not processed
```

### Stale Message Handling

Messages older than the configured stale duration are automatically discarded:

```typescript
// Configure in environment
RABBITMQ_STALE_DURATION=300000  // 5 minutes
```

### Health Monitoring

```typescript
// Check service status
const isConnected = rabbitMQService.isConnected();

// Get comprehensive statistics
const stats = rabbitMQService.getStats();
console.log('Service stats:', stats);
```

### Memory Management

```typescript
// Clear processed message cache (useful for long-running services)
rabbitMQService.clearProcessedMessagesCache();
```

## Integration with Existing Application

### 1. Update your loader (recommended)

Create a new loader file or update existing one:

```typescript
// src/loaders/newRabbitMQLoader.ts
import { Container } from 'typedi';
import { RabbitMQService } from './RabbitMQService';
import { myMessageProcessor } from '../processors/MessageProcessor';

export const newRabbitMQLoader = async (): Promise<void> => {
  const rabbitMQService = Container.get(RabbitMQService);
  
  // Register your processors
  rabbitMQService.registerDefaultProcessor(myMessageProcessor);
  
  // Connect to RabbitMQ
  await rabbitMQService.connectToRabbitMQ();
};
```

### 2. Update app.ts

```typescript
// src/app.ts
import './loaders/iocLoader';
import './loaders/winstonLoader';
import './loaders/expressLoader';
import './loaders/homeLoader';
import './loaders/DBLoader';
import './loaders/newRabbitMQLoader'; // Add this line

// Remove the old RabbitMQ import if you're replacing it
```

### 3. Create message processors

```typescript
// src/processors/MessageProcessor.ts
import { IMessageProcessor } from '../loaders/RabbitMQService';
import { Logger } from '../lib/logger';

const log = new Logger(__filename);

export const myMessageProcessor: IMessageProcessor = async (event, context, headers) => {
  const logMessage = constructLogMessage(__filename, 'myMessageProcessor', headers);
  log.info(`${logMessage} :: Processing message`, {
    type: event.type,
    routingKey: context.routingKey
  });
  
  try {
    // Your business logic here
    switch (event.type) {
      case 'user.created':
        await handleUserCreated(event);
        break;
      case 'order.placed':
        await handleOrderPlaced(event);
        break;
      default:
        log.warn(`${logMessage} :: Unknown event type: ${event.type}`);
    }
  } catch (error) {
    log.error(`${logMessage} :: Error processing message`, { error: error.message });
    throw error; // Re-throw to trigger message rejection
  }
};
```

## Error Handling

The service provides comprehensive error handling:

- **Connection errors**: Automatic retry with exponential backoff
- **Processing errors**: Messages are rejected (not requeued) to prevent infinite loops
- **Channel errors**: Automatic channel recreation
- **Graceful shutdown**: Proper cleanup on SIGINT/SIGTERM

## Logging

Configurable logging levels:
- `debug`: Detailed debugging information
- `info`: General information
- `warn`: Warning messages
- `error`: Error messages

Configure via environment:
```env
RABBITMQ_LOG_LEVEL=info
```

## Testing

The service is designed to be easily testable:

```typescript
// Mock the service in tests
const mockRabbitMQService = {
  registerDefaultProcessor: jest.fn(),
  publishMessage: jest.fn(),
  connectToRabbitMQ: jest.fn(),
  // ... other methods
};

Container.set(RabbitMQService, mockRabbitMQService);
```

## Migration from Functional Implementation

If you're migrating from the functional `RabbitMQLoader.ts`:

1. **Keep the old file** for reference
2. **Create processors** for your existing message handling logic
3. **Update loaders** to use the new service
4. **Test thoroughly** with both implementations running in parallel initially
5. **Remove old implementation** once confident in the new one

## Performance Considerations

- **Prefetch settings**: Configure per queue based on processing capacity
- **Channel management**: Service manages channels efficiently
- **Memory usage**: Processed message cache grows over time - clear periodically
- **Connection pooling**: Single connection with multiple channels for efficiency

## Troubleshooting

### Common Issues

1. **"amqplib not installed"**: Run `npm install amqplib @types/amqplib`
2. **Connection failures**: Check RabbitMQ URL and credentials
3. **TypeScript errors**: Ensure `@types/node` is installed
4. **Messages not processing**: Check queue binding and routing keys
5. **Memory leaks**: Clear processed message cache regularly

### Debug Mode

Enable debug logging to see detailed information:

```env
RABBITMQ_LOG_LEVEL=debug
```

This will show:
- Connection attempts
- Channel creation
- Message processing details
- Error stack traces

## Backward Compatibility

The service provides backward compatibility through:

1. **Export functions**: `connectToRabbitMQ()`, `isConnected()`, `getRabbitMQService()`
2. **Default processor**: `registerDefaultProcessor()` for simple use cases
3. **Environment variables**: Same configuration as functional implementation

## Future Enhancements

Potential future features:
- Message acknowledgment strategies
- Dead letter queue support
- Metrics and monitoring integration
- Plugin system for custom processors
- Connection pooling optimization

---

For questions or issues, refer to the source code in `src/loaders/RabbitMQService.ts` and the comprehensive examples provided above.