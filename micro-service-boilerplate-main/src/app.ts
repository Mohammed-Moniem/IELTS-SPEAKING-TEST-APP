import 'dotenv/config';
import 'reflect-metadata';

import './loaders/iocLoader';
import './loaders/telemetryLoader';

import { banner } from './lib/banner';
import { Logger } from './lib/logger';
import connectDB from './loaders/DBLoader';
import './loaders/expressLoader';
import './loaders/homeLoader';
import { connectToRabbitMQ } from './loaders/RabbitMQLoader';
import { initializeNotificationScheduler } from './loaders/NotificationScheduler';
import { winstonLoader } from './loaders/winstonLoader';

const log = new Logger(__filename);

(async function initiateLoader() {
  try {
    await connectDB();
    await winstonLoader();
    await connectToRabbitMQ();
    initializeNotificationScheduler();
  } catch (error: any) {
    log.error(`Error while initializing the app`, { error });
  }
})();

try {
  banner(log);
} catch (error: any) {
  log.error('Application Crashed ', error);
}
