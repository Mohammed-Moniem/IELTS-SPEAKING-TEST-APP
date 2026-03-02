import { env } from '@env';
import { GrowthService } from '@services/GrowthService';
import Container from 'typedi';

import { Logger } from '../lib/logger';

const log = new Logger(__filename);

export function initializeGrowthScheduler(): void {
  const blogEnabled = env.growth.blogSchedulerEnabled;
  const deckEnabled = env.growth.deckSchedulerEnabled;

  if (!blogEnabled && !deckEnabled) {
    log.info('Growth schedulers disabled; growth scheduler not started');
    return;
  }

  const growthService = Container.get(GrowthService);

  const runBlogSweep = async (trigger: 'startup' | 'interval') => {
    if (!blogEnabled) return;

    try {
      const summary = await growthService.runBlogAutomationSweep({
        queueLimit: env.growth.blogQueueLimit,
        jobLimit: env.growth.blogJobLimit
      });

      if (summary.processedJobs > 0 || summary.autoPublishedPosts > 0 || summary.queuedRefreshJobs > 0) {
        log.info(`Growth blog sweep completed (${trigger})`, summary);
      }
    } catch (error) {
      log.error('Growth blog sweep failed', { error, trigger });
    }
  };

  const runDeckSweep = async (trigger: 'startup' | 'interval') => {
    if (!deckEnabled) return;

    try {
      const summary = await growthService.runDeckReviewSweep({
        limit: env.growth.deckReviewLimit
      });

      if (summary.processed > 0) {
        log.info(`Growth deck sweep completed (${trigger})`, summary);
      }
    } catch (error) {
      log.error('Growth deck sweep failed', { error, trigger });
    }
  };

  void runBlogSweep('startup');
  void runDeckSweep('startup');

  if (blogEnabled) {
    const blogTimer = setInterval(() => {
      void runBlogSweep('interval');
    }, Math.max(60_000, env.growth.blogSweepIntervalMs));
    blogTimer.unref();
  }

  if (deckEnabled) {
    const deckTimer = setInterval(() => {
      void runDeckSweep('interval');
    }, Math.max(60_000, env.growth.deckSweepIntervalMs));
    deckTimer.unref();
  }

  log.info(
    `Growth scheduler started (blog=${blogEnabled ? 'on' : 'off'}, deck=${deckEnabled ? 'on' : 'off'})`
  );
}
