import { env } from '@env';
import { NotificationService } from '@services/NotificationService';
import Container from 'typedi';

import { Logger } from '../lib/logger';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly
const log = new Logger(__filename);

export function initializeNotificationScheduler(): void {
  if (!env.push.enabled) {
    log.info('Push notifications disabled; scheduler not started');
    return;
  }

  const notificationService = Container.get(NotificationService);

  const runInactivitySweep = async () => {
    try {
      const candidates = await notificationService.findUsersNeedingInactivityReminder();
      if (candidates.length === 0) {
        return;
      }

      log.info(`Scheduling inactivity reminders for ${candidates.length} users`);
      for (const candidate of candidates) {
        await notificationService.notifyInactivity(candidate.userId, candidate.daysInactive);
      }
    } catch (error) {
      log.error('Failed to process inactivity reminders', { error });
    }
  };

  // Run immediately on startup
  runInactivitySweep().catch(error => log.error('Initial inactivity sweep failed', { error }));

  // Schedule recurring sweep
  const timer = setInterval(() => {
    runInactivitySweep().catch(error => log.error('Inactivity sweep failed', { error }));
  }, CHECK_INTERVAL_MS);

  // Prevent timer from keeping the event loop alive unnecessarily
  timer.unref();
}
