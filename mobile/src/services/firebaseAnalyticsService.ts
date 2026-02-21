/*
  firebaseAnalyticsService
  - Lightweight, safe wrapper around @react-native-firebase/analytics
  - Dynamically requires the native module so the app won't crash in environments
    where the native Firebase Analytics module isn't available (Expo managed JS-only).
*/

let analytics: any = null;
let enabled = false;

const tryInit = async () => {
  if (enabled) return;
  try {
    // dynamic require so bundler doesn't break when native module is missing
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rnFirebaseAnalytics =
      require("@react-native-firebase/analytics").default;
    analytics = rnFirebaseAnalytics();
    enabled = true;
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("📊 firebaseAnalyticsService: initialized");
    }
  } catch (err) {
    enabled = false;
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log(
        "📊 firebaseAnalyticsService: native analytics not available, noop mode",
        err
      );
    }
  }
};

const firebaseAnalyticsService = {
  async initialize() {
    await tryInit();
  },

  async trackEvent(name: string, params?: Record<string, unknown>) {
    if (!enabled || !analytics) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log("📊 trackEvent noop:", name, params || {});
      }
      return;
    }

    try {
      await analytics.logEvent(name, params || {});
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.warn("📊 trackEvent failed", name, err);
      }
    }
  },

  async trackScreen(screenName: string, params?: Record<string, unknown>) {
    if (!enabled || !analytics) return;
    try {
      await analytics.logEvent("screen_view", {
        screen_name: screenName,
        ...(params || {}),
      });
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.warn("📊 trackScreen failed", screenName, err);
      }
    }
  },

  async setUserId(userId: string | null) {
    if (!enabled || !analytics) return;
    try {
      await analytics.setUserId(userId as any);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.warn("📊 setUserId failed", err);
      }
    }
  },

  async setUserProperties(properties: Record<string, string>) {
    if (!enabled || !analytics) return;
    try {
      for (const key of Object.keys(properties)) {
        // @ts-ignore
        await analytics.setUserProperty(key, properties[key]);
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.warn("📊 setUserProperties failed", err);
      }
    }
  },

  isEnabled() {
    return enabled;
  },
};

export default firebaseAnalyticsService;
