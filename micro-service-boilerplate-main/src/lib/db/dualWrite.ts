import { env } from '@env';
import { Logger } from '@lib/logger';
import { DualWriteResult } from './types';

const log = new Logger(__filename);

export const runDualWrite = async <T>(
  primary: () => Promise<T>,
  secondary?: () => Promise<T>
): Promise<DualWriteResult<T>> => {
  const primaryResult = await primary();

  if (!secondary || env.db.writeMode !== 'dual') {
    return { primary: primaryResult };
  }

  try {
    const secondaryResult = await secondary();
    const parityMatched = JSON.stringify(primaryResult) === JSON.stringify(secondaryResult);

    if (env.db.parityLogging && !parityMatched) {
      log.warn('Dual-write parity mismatch detected');
    }

    return {
      primary: primaryResult,
      secondary: secondaryResult,
      parityMatched
    };
  } catch (error) {
    log.error('Secondary dual-write failed', error);
    return {
      primary: primaryResult,
      parityMatched: false
    };
  }
};
