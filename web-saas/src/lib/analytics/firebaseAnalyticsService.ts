'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAnalytics,
  isSupported,
  logEvent,
  setUserId,
  setUserProperties,
  type Analytics
} from 'firebase/analytics';

type AnalyticsParams = Record<string, string | number | boolean | undefined>;
type UserPropertyValue = string | null | undefined;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const analyticsEnabledByEnv = (process.env.NEXT_PUBLIC_FIREBASE_ANALYTICS_ENABLED || 'true') !== 'false';
const hasRequiredConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId &&
    firebaseConfig.measurementId
);

let enabled = false;
let analyticsInstance: Analytics | null = null;
let initPromise: Promise<void> | null = null;

const toAnalyticsPayload = (params?: AnalyticsParams) => {
  if (!params) return undefined;

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined)
  ) as Record<string, string | number | boolean>;
};

const normalizeUserProperties = (properties: Record<string, UserPropertyValue>) => {
  const entries = Object.entries(properties).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === 'string' && entry[1].length > 0
  );

  return Object.fromEntries(entries);
};

const safeInitialize = async () => {
  if (enabled || !analyticsEnabledByEnv || !hasRequiredConfig || typeof window === 'undefined') {
    return;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const supported = await isSupported().catch(() => false);
      if (!supported) return;

      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      analyticsInstance = getAnalytics(app);
      enabled = true;

      if (process.env.NODE_ENV === 'development') {
        console.log('Firebase web analytics initialized');
      }
    })();
  }

  await initPromise;
};

const firebaseAnalyticsService = {
  async initialize() {
    await safeInitialize();
  },

  isEnabled() {
    return enabled;
  },

  async trackEvent(name: string, params?: AnalyticsParams) {
    await safeInitialize();
    if (!enabled || !analyticsInstance) return;

    logEvent(analyticsInstance, name, toAnalyticsPayload(params));
  },

  async trackScreen(screenName: string, params?: AnalyticsParams) {
    await safeInitialize();
    if (!enabled || !analyticsInstance) return;

    if (typeof window !== 'undefined') {
      logEvent(analyticsInstance, 'page_view', {
        page_location: window.location.href,
        page_path: window.location.pathname,
        page_title: document.title
      });
    }

    logEvent(analyticsInstance, 'web_screen_view', {
      screen_name: screenName,
      ...toAnalyticsPayload(params)
    });
  },

  async setUserId(userId: string | null) {
    await safeInitialize();
    if (!enabled || !analyticsInstance) return;
    setUserId(analyticsInstance, userId);
  },

  async setUserProperties(properties: Record<string, UserPropertyValue>) {
    await safeInitialize();
    if (!enabled || !analyticsInstance) return;

    const normalized = normalizeUserProperties(properties);
    if (Object.keys(normalized).length === 0) return;

    setUserProperties(analyticsInstance, normalized);
  }
};

export default firebaseAnalyticsService;
