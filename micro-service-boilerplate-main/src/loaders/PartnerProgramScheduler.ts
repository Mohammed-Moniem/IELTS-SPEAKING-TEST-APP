import { env } from '@env';
import { PartnerProgramService } from '@services/PartnerProgramService';
import Container from 'typedi';

import { Logger } from '../lib/logger';

const log = new Logger(__filename);

let lastReconciledDateUtc: string | null = null;
let reconcileInFlight = false;

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isPastScheduledTime(date: Date): boolean {
  const hour = env.partnerProgram.targetReconcileHourUtc;
  const minute = env.partnerProgram.targetReconcileMinuteUtc;

  if (date.getUTCHours() > hour) {
    return true;
  }

  if (date.getUTCHours() < hour) {
    return false;
  }

  return date.getUTCMinutes() >= minute;
}

export function initializePartnerProgramScheduler(): void {
  if (!env.partnerProgram.targetReconcileEnabled) {
    log.info('Partner target reconciliation scheduler disabled; scheduler not started');
    return;
  }

  const partnerProgramService = Container.get(PartnerProgramService);
  const checkIntervalMs = Math.max(60_000, env.partnerProgram.targetReconcileCheckIntervalMs);

  const maybeRunReconcile = async (trigger: 'startup' | 'interval') => {
    if (reconcileInFlight) {
      return;
    }

    const now = new Date();
    const todayUtc = toUtcDateKey(now);

    if (lastReconciledDateUtc === todayUtc) {
      return;
    }

    if (!isPastScheduledTime(now)) {
      return;
    }

    reconcileInFlight = true;
    try {
      const enabled = await partnerProgramService.isEnabled();
      if (!enabled) {
        return;
      }

      const summary = await partnerProgramService.reconcileTargets(now);
      lastReconciledDateUtc = todayUtc;
      log.info(`Partner target reconciliation completed (${trigger})`, summary);
    } catch (error) {
      log.error('Partner target reconciliation failed', { error });
    } finally {
      reconcileInFlight = false;
    }
  };

  // Opportunistic run on startup if today has reached the scheduled UTC time.
  void maybeRunReconcile('startup');

  const timer = setInterval(() => {
    void maybeRunReconcile('interval');
  }, checkIntervalMs);

  // Do not keep Node alive only for this timer.
  timer.unref();

  log.info(
    `Partner target reconciliation scheduler started (hour=${env.partnerProgram.targetReconcileHourUtc} UTC, minute=${env.partnerProgram.targetReconcileMinuteUtc} UTC, interval=${checkIntervalMs}ms)`
  );
}
