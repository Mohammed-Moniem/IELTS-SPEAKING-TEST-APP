import { env } from '@env';
import { NotificationCampaignService } from '@services/NotificationCampaignService';
import { NotificationService } from '@services/NotificationService';
import Container from 'typedi';

import { Logger } from '../lib/logger';

const INACTIVITY_CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly
const log = new Logger(__filename);

export function initializeNotificationScheduler(): void {
  if (!env.push.enabled) {
    log.info('Push notifications disabled; scheduler not started');
    return;
  }

  const notificationService = Container.get(NotificationService);
  const campaignService = Container.get(NotificationCampaignService);

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

  const runCampaignSweep = async () => {
    if (!env.push.campaignSchedulerEnabled) {
      return;
    }

    try {
      const result = await campaignService.processDueCampaigns();
      if (result.processed > 0) {
        log.info('Processed due notification campaigns', result);
      }
    } catch (error) {
      log.error('Failed to process due notification campaigns', { error });
    }
  };

  // Run immediately on startup
  runInactivitySweep().catch(error => log.error('Initial inactivity sweep failed', { error }));
  runCampaignSweep().catch(error => log.error('Initial campaign sweep failed', { error }));

  // Schedule recurring inactivity sweep
  const inactivityTimer = setInterval(() => {
    runInactivitySweep().catch(error => log.error('Inactivity sweep failed', { error }));
  }, INACTIVITY_CHECK_INTERVAL_MS);

  inactivityTimer.unref();

  if (env.push.campaignSchedulerEnabled) {
    const campaignTimer = setInterval(() => {
      runCampaignSweep().catch(error => log.error('Campaign sweep failed', { error }));
    }, env.push.campaignSweepIntervalMs);

    campaignTimer.unref();
  } else {
    log.info('Push campaign scheduler disabled by env; scheduled campaigns require manual send/fallback');
  }
}
