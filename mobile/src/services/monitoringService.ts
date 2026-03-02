import Constants from "expo-constants";

import type { User } from "../types/api";

type SentryLikeModule = {
  init?: (options: Record<string, unknown>) => void;
  setUser?: (user: Record<string, unknown> | null) => void;
  setTag?: (key: string, value: string) => void;
  configureScope?: (callback: (scope: any) => void) => void;
  captureException?: (
    error: Error,
    context?: Record<string, unknown>
  ) => void;
  captureMessage?: (message: string, level?: SeverityLevel) => void;
  addBreadcrumb?: (breadcrumb: Record<string, unknown>) => void;
  setContext?: (key: string, context: Record<string, unknown>) => void;
  Native?: SentryLikeModule;
};

let cachedSentryModule: SentryLikeModule | null = null;
const loadSentryModule = (): SentryLikeModule | null => {
  if (cachedSentryModule) {
    return cachedSentryModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedSentryModule = require("@sentry/react-native");
    return cachedSentryModule;
  } catch (_error) {
    // Fallback kept for local environments that may still have sentry-expo.
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

const getSentryClient = (): SentryLikeModule | null => {
  const module = loadSentryModule();
  if (!module) return null;
  return module.Native || module;
};

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

    const sentryModule = loadSentryModule();
    if (!sentryModule || !sentryModule.init) {
      if (__DEV__) {
        console.log("📡 Monitoring", "Sentry package missing, skipping init");
      }
      this.initialized = true;
      return;
    }

    sentryModule.init({
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

    const sentryClient = getSentryClient();
    if (!sentryClient || !sentryClient.setUser) {
      return;
    }

    if (user) {
      sentryClient.setUser({
        id: user._id,
        email: user.email,
        username: `${user.firstName} ${user.lastName}`.trim(),
      });
      sentryClient.setTag?.("subscription_plan", user.subscriptionPlan);
    } else {
      sentryClient.setUser(null);
      sentryClient.configureScope?.((scope) => {
        scope.setTag("subscription_plan", "none");
      });
    }
  }

  captureException(error: unknown, context?: EventPayload): void {
    if (!this.sentryEnabled) {
      return;
    }

    const sentryClient = getSentryClient();
    if (!sentryClient?.captureException) {
      return;
    }

    const normalizedError =
      error instanceof Error ? error : new Error(String(error));

    sentryClient.captureException(normalizedError, {
      extra: context,
    });
  }

  captureMessage(message: string, level: SeverityLevel = "info"): void {
    if (!this.sentryEnabled) {
      return;
    }

    const sentryClient = getSentryClient();
    if (!sentryClient?.captureMessage) {
      return;
    }

    sentryClient.captureMessage(message, level);
  }

  addBreadcrumb(message: string, data?: EventPayload): void {
    if (!this.sentryEnabled) {
      return;
    }

    const sentryClient = getSentryClient();
    if (!sentryClient?.addBreadcrumb) {
      return;
    }

    sentryClient.addBreadcrumb({
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
    const safeProperties = properties ?? {};
    this.addBreadcrumb("screen_view", { screen: name, ...safeProperties });

    if (this.sentryEnabled) {
      const sentryClient = getSentryClient();
      if (sentryClient?.setContext) {
        sentryClient.setContext("last_screen", { name, ...safeProperties });
      }
    }

    if (__DEV__) {
      console.log("🧭 Screen", name, properties || "");
    }
  }
}

const monitoringService = new MonitoringService();

export default monitoringService;
