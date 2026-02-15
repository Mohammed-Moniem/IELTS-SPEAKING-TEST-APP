import Constants from "expo-constants";

import type { User } from "../types/api";

type SentryExpoModule = typeof import("sentry-expo");

let cachedSentryModule: SentryExpoModule | null = null;
const loadSentryModule = (): SentryExpoModule | null => {
  if (cachedSentryModule) {
    return cachedSentryModule;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedSentryModule = require("sentry-expo");
  } catch (error) {
    if (__DEV__) {
      console.warn("📡 Monitoring", "Sentry module unavailable:", error);
    }
    cachedSentryModule = null;
  }
  return cachedSentryModule;
};

type EventPayload = Record<string, unknown>;

type SeverityLevel = "fatal" | "error" | "warning" | "log" | "info" | "debug";

class MonitoringService {
  private initialized = false;
  private sentryEnabled = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }

    const extras = (Constants.expoConfig?.extra || {}) as {
      sentryDsn?: string;
      environment?: string;
    };

    const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN || extras.sentryDsn || "";

    if (!dsn) {
      if (__DEV__) {
        console.log(
          "📡 Monitoring",
          "Sentry DSN not configured, skipping init"
        );
      }
      this.initialized = true;
      return;
    }

    const Sentry = loadSentryModule();
    if (!Sentry) {
      if (__DEV__) {
        console.log("📡 Monitoring", "Sentry package missing, skipping init");
      }
      this.initialized = true;
      return;
    }

    Sentry.init({
      dsn,
      enableInExpoDevelopment: false,
      debug: __DEV__,
      enableNative: true,
      enableAutoSessionTracking: true,
      tracesSampleRate: 0.2,
      environment:
        extras.environment || (__DEV__ ? "development" : "production"),
    });

    this.sentryEnabled = true;
    this.initialized = true;

    if (__DEV__) {
      console.log("📡 Monitoring", "Sentry initialized");
    }
  }

  setUser(user: User | null): void {
    if (!this.sentryEnabled) {
      return;
    }

    if (user) {
      const Sentry = loadSentryModule();
      if (!Sentry) {
        return;
      }
      Sentry.Native.setUser({
        id: user._id,
        email: user.email,
        username: `${user.firstName} ${user.lastName}`.trim(),
      });
      Sentry.Native.setTag("subscription_plan", user.subscriptionPlan);
    } else {
      const Sentry = loadSentryModule();
      if (!Sentry) {
        return;
      }
      Sentry.Native.setUser(null);
      Sentry.Native.configureScope((scope) => {
        scope.setTag("subscription_plan", "none");
      });
    }
  }

  captureException(error: unknown, context?: EventPayload): void {
    if (!this.sentryEnabled) {
      return;
    }

    const Sentry = loadSentryModule();
    if (!Sentry) {
      return;
    }

    const normalizedError =
      error instanceof Error ? error : new Error(String(error));

    Sentry.Native.captureException(normalizedError, {
      extra: context,
    });
  }

  captureMessage(message: string, level: SeverityLevel = "info"): void {
    if (!this.sentryEnabled) {
      return;
    }

    const Sentry = loadSentryModule();
    if (!Sentry) {
      return;
    }

    Sentry.Native.captureMessage(message, level);
  }

  addBreadcrumb(message: string, data?: EventPayload): void {
    if (!this.sentryEnabled) {
      return;
    }

    const Sentry = loadSentryModule();
    if (!Sentry) {
      return;
    }

    Sentry.Native.addBreadcrumb({
      category: "event",
      message,
      data,
      level: "info",
    });
  }

  trackEvent(name: string, properties?: EventPayload): void {
    this.addBreadcrumb(name, properties);

    if (__DEV__) {
      console.log("📊 Event", name, properties || "");
    }
  }

  trackScreen(name: string, properties?: EventPayload): void {
    this.addBreadcrumb("screen_view", { screen: name, ...properties });

    if (this.sentryEnabled) {
      const Sentry = loadSentryModule();
      if (Sentry) {
        Sentry.Native.setContext("last_screen", { name, ...properties });
      }
    }

    if (__DEV__) {
      console.log("🧭 Screen", name, properties || "");
    }
  }
}

const monitoringService = new MonitoringService();

export default monitoringService;
