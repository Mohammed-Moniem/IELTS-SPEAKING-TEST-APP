/**
 * Logger utility that conditionally logs based on environment
 * Prevents console pollution in production builds
 */

import monitoringService from "../services/monitoringService";

const isDevelopment = __DEV__;

class Logger {
  /**
   * Log informational messages (only in development)
   */
  log(...args: any[]) {
    if (isDevelopment) {
      console.log(...args);
    }
  }

  /**
   * Log error messages (always logged, but can be sent to error tracking in production)
   */
  error(...args: any[]) {
    console.error(...args);

    const errorArg = args.find((arg) => arg instanceof Error) as
      | Error
      | undefined;

    const derivedError =
      errorArg ||
      (typeof args[0] === "string" ? new Error(args[0]) : undefined);

    if (derivedError) {
      const context = {
        arguments: args.map((arg) => {
          if (arg instanceof Error) {
            return { message: arg.message, stack: arg.stack };
          }
          return arg;
        }),
      };
      monitoringService.captureException(derivedError, context);
    } else {
      monitoringService.captureMessage("logger.error invoked", "warning");
    }
  }

  /**
   * Log warning messages (only in development)
   */
  warn(...args: any[]) {
    if (isDevelopment) {
      console.warn(...args);
    }
  }

  /**
   * Log debug messages (only in development)
   */
  debug(...args: any[]) {
    if (isDevelopment) {
      console.debug(...args);
    }
  }

  /**
   * Log info messages with emoji prefix (only in development)
   */
  info(emoji: string, ...args: any[]) {
    if (isDevelopment) {
      console.log(emoji, ...args);
    }
  }

  /**
   * Log success messages (only in development)
   */
  success(...args: any[]) {
    if (isDevelopment) {
      console.log("✅", ...args);
    }
  }

  /**
   * Log API requests (only in development)
   */
  apiRequest(method: string, url: string, data?: any) {
    if (isDevelopment) {
      console.log(`📤 API ${method.toUpperCase()}:`, url, data || "");
    }
  }

  /**
   * Log API responses (only in development)
   */
  apiResponse(status: number, url: string, data?: any) {
    if (isDevelopment) {
      const emoji = status >= 200 && status < 300 ? "✅" : "❌";
      console.log(`${emoji} API Response [${status}]:`, url, data || "");
    }
  }

  /**
   * Log API errors (only in development)
   */
  apiError(error: any) {
    if (isDevelopment) {
      console.error("❌ API Error:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
      });
    }
  }

  /**
   * Log socket events (only in development)
   */
  socket(event: string, data?: any) {
    if (isDevelopment) {
      console.log(`🔌 Socket [${event}]:`, data || "");
    }
  }

  /**
   * Log navigation events (only in development)
   */
  navigation(screen: string, params?: any) {
    if (isDevelopment) {
      console.log(`🧭 Navigation → ${screen}`, params || "");
    }
  }
}

export const logger = new Logger();
