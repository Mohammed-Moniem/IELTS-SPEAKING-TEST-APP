import { Alert } from "react-native";
import { logger } from "./logger";

type RateLimiterOptions = {
  maxRequests: number;
  perMilliseconds: number;
  showUserWarning?: boolean; // Show alert to user when rate limit is hit
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Simple sliding-window rate limiter that restricts how many actions
 * can be performed per key within a given time window.
 *
 * Features:
 * - Sliding window algorithm for accurate rate limiting
 * - Per-endpoint tracking (e.g., GET:/api/users, POST:/api/sessions)
 * - Automatic request queueing when limit is reached
 * - User-friendly warnings and error messages
 */
export class RateLimiter {
  private readonly maxRequests: number;
  private readonly perMilliseconds: number;
  private readonly showUserWarning: boolean;
  private readonly requestLog = new Map<string, number[]>();
  private lastWarningTime = 0; // Prevent spam warnings

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.perMilliseconds = options.perMilliseconds;
    this.showUserWarning = options.showUserWarning ?? false;
  }

  private cleanOldEntries(key: string, now: number) {
    const timestamps = this.requestLog.get(key);
    if (!timestamps || timestamps.length === 0) {
      return;
    }

    // Drop anything that is outside the sliding window
    while (
      timestamps.length > 0 &&
      now - timestamps[0] >= this.perMilliseconds
    ) {
      timestamps.shift();
    }
  }

  private getTimestamps(key: string): number[] {
    if (!this.requestLog.has(key)) {
      this.requestLog.set(key, []);
    }
    return this.requestLog.get(key)!;
  }

  async schedule(key: string): Promise<void> {
    let delayCount = 0;
    const maxDelays = 3; // Prevent infinite delays

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const now = Date.now();
      const timestamps = this.getTimestamps(key);
      this.cleanOldEntries(key, now);

      if (timestamps.length < this.maxRequests) {
        timestamps.push(now);
        return;
      }

      // Calculate wait time
      const waitTime = Math.max(
        this.perMilliseconds - (now - timestamps[0]),
        0
      );

      delayCount++;

      // Log rate limit hit
      if (__DEV__) {
        const seconds = Math.ceil(waitTime / 100) / 10;
        logger.warn(
          "⏳",
          `Rate limit reached for ${key}. Delaying next request by ~${seconds}s (${delayCount}/${maxDelays})`
        );
      }

      // Show user warning (but not too frequently)
      if (
        this.showUserWarning &&
        delayCount === 1 &&
        now - this.lastWarningTime > 30000
      ) {
        this.lastWarningTime = now;
        const seconds = Math.ceil(waitTime / 1000);
        Alert.alert(
          "Slow Down",
          `You're making requests too quickly. Please wait ${seconds} second${
            seconds !== 1 ? "s" : ""
          }.`,
          [{ text: "OK" }]
        );
      }

      // If we've delayed too many times, reject to prevent hanging
      if (delayCount > maxDelays) {
        logger.error(`Rate limit exceeded max delays for ${key}`);
        throw new Error("Rate limit exceeded. Please try again later.");
      }

      await sleep(waitTime || 10);
    }
  }

  reset(key?: string) {
    if (key) {
      this.requestLog.delete(key);
      logger.debug(`Rate limiter reset for key: ${key}`);
      return;
    }
    this.requestLog.clear();
    logger.debug("Rate limiter cleared all keys");
  }

  /**
   * Get current status for debugging
   */
  getStatus(): Record<
    string,
    { count: number; limit: number; window: string }
  > {
    const status: Record<
      string,
      { count: number; limit: number; window: string }
    > = {};
    const now = Date.now();

    this.requestLog.forEach((timestamps, key) => {
      // Clean old entries
      const validTimestamps = timestamps.filter(
        (ts) => now - ts < this.perMilliseconds
      );

      status[key] = {
        count: validTimestamps.length,
        limit: this.maxRequests,
        window: `${this.perMilliseconds / 1000}s`,
      };
    });

    return status;
  }

  /**
   * Check if a key is currently rate limited
   */
  isRateLimited(key: string): boolean {
    const now = Date.now();
    const timestamps = this.getTimestamps(key);
    this.cleanOldEntries(key, now);
    return timestamps.length >= this.maxRequests;
  }

  /**
   * Get remaining requests for a key
   */
  getRemainingRequests(key: string): number {
    const now = Date.now();
    const timestamps = this.getTimestamps(key);
    this.cleanOldEntries(key, now);
    return Math.max(0, this.maxRequests - timestamps.length);
  }
}

/**
 * Default rate limiter: 10 requests per minute per endpoint
 * Used for most API calls
 */
export const rateLimiter = new RateLimiter({
  maxRequests: 10,
  perMilliseconds: 60_000,
  showUserWarning: false, // Don't show warnings for normal operations
});

/**
 * Strict rate limiter: 5 requests per minute per endpoint
 * Use for sensitive operations (auth, payments, etc.)
 */
export const strictRateLimiter = new RateLimiter({
  maxRequests: 5,
  perMilliseconds: 60_000,
  showUserWarning: true, // Show warnings for sensitive operations
});
