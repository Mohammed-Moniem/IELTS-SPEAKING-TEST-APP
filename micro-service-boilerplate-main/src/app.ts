import 'dotenv/config';
import 'reflect-metadata';

import './loaders/iocLoader';
import './loaders/telemetryLoader';

import { banner } from './lib/banner';
import { Logger } from './lib/logger';
import connectDB from './loaders/DBLoader';
import { initializeNotificationScheduler } from './loaders/NotificationScheduler';
import { connectToRabbitMQ } from './loaders/RabbitMQLoader';
import { winstonLoader } from './loaders/winstonLoader';

const log = new Logger(__filename);

(async function initiateLoader() {
  try {
    await connectDB();
    await winstonLoader();
    await connectToRabbitMQ();
    // Start HTTP server only after core dependencies are ready
    await import('./loaders/expressLoader');
    await import('./loaders/homeLoader');
    initializeNotificationScheduler();
  } catch (error: any) {
    log.error(`Error while initializing the app`, { error });
    process.exit(1);
  }
})();

try {
  banner(log);
} catch (error: any) {
  log.error('Application Crashed ', error);
}
