/**
 * Logger utility that conditionally logs based on environment
 * Prevents console pollution in production builds
 */

import monitoringService from "../services/monitoringService";

const isDevelopment = __DEV__;
const MAX_LOG_STRING_LENGTH = 800;

const truncateString = (value: string): string => {
  if (value.length <= MAX_LOG_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_LOG_STRING_LENGTH)}...(truncated)`;
};

const serializeForLog = (value: any): any => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateString(value.message),
      stack: value.stack,
    };
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (value && typeof value === "object") {
    const axiosLike = value as {
      isAxiosError?: boolean;
      message?: string;
      code?: string;
      config?: { url?: string; method?: string };
      response?: { status?: number; data?: unknown };
    };

    if (axiosLike.isAxiosError) {
      return {
        message: truncateString(axiosLike.message || "Axios error"),
        code: axiosLike.code,
        status: axiosLike.response?.status,
        method: axiosLike.config?.method?.toUpperCase(),
        url: axiosLike.config?.url,
        data: axiosLike.response?.data,
      };
    }

    try {
      return JSON.parse(
        JSON.stringify(value, (_key, entry) => {
          if (typeof entry === "string") {
            return truncateString(entry);
          }
          return entry;
        })
      );
    } catch (_error) {
      return String(value);
    }
  }

  return value;
};

const getErrorStatus = (error: any): number | undefined => {
  const status = error?.response?.status ?? error?.status ?? error?.data?.status;
  return typeof status === "number" ? status : undefined;
};

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
    const safeArgs = args.map(serializeForLog);
    if (isDevelopment) {
      console.warn(...safeArgs);
    } else {
      console.error(...safeArgs);
    }

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
          return serializeForLog(arg);
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
      const status = getErrorStatus(error);
      const url = error?.config?.url ?? error?.response?.config?.url;
      const responseData = error?.response?.data;
      const responseDataString =
        typeof responseData === "string"
          ? responseData
          : JSON.stringify(responseData || "");
      const isSpeechBillingIssue =
        typeof url === "string" &&
        url.includes("/speech/synthesize") &&
        (status === 402 || status === 500) &&
        /payment_required|paid_plan_required|payment_issue|billing/i.test(
          responseDataString
        );

      if (isSpeechBillingIssue) {
        console.log(
          "ℹ️ Speech provider is temporarily unavailable; continuing with fallback behavior."
        );
        return;
      }

      const payload = {
        message: error.message,
        status,
        data: responseData,
        url,
      };

      if (payload.status === 401 || payload.status === 403) {
        console.log("ℹ️ API auth response:", serializeForLog(payload));
        return;
      }

      console.warn("⚠️ API request failed:", serializeForLog(payload));
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
