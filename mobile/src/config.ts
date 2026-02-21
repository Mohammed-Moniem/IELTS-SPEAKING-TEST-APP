import Constants from "expo-constants";

// API Configuration is centralized here so both the API client and the rest of
// the app resolve URLs/keys the exact same way (env → Expo extra → fallback).
const FALLBACK_API_URL = "http://localhost:4000/api/v1";
const FALLBACK_SOCKET_URL = "http://localhost:4000";
const FALLBACK_API_KEY = "local-dev-api-key";

type ExpoExtra = {
  apiUrl?: string;
  socketUrl?: string;
  apiKey?: string;
  appEnv?: string;
};

const expoExtra = (Constants.expoConfig?.extra || {}) as ExpoExtra;

const resolveConfigValue = (
  envValue: string | undefined,
  extraValue: string | undefined,
  fallback: string
) => {
  if (envValue && envValue.length > 0) {
    return envValue;
  }
  if (extraValue && extraValue.length > 0) {
    return extraValue;
  }
  return fallback;
};

export const API_BASE_URL = resolveConfigValue(
  process.env.EXPO_PUBLIC_API_URL,
  expoExtra.apiUrl,
  FALLBACK_API_URL
);

const resolvedSocket =
  process.env.EXPO_PUBLIC_SOCKET_URL ??
  expoExtra.socketUrl ??
  (API_BASE_URL.replace(/\/api\/v1$/, "") || FALLBACK_SOCKET_URL);

export const SOCKET_URL = resolvedSocket;

export const API_KEY = resolveConfigValue(
  process.env.EXPO_PUBLIC_API_KEY,
  expoExtra.apiKey,
  FALLBACK_API_KEY
);

export const APP_ENV =
  process.env.EXPO_PUBLIC_APP_ENV ??
  expoExtra.appEnv ??
  (__DEV__ ? "development" : "production");

// App Configuration
export const APP_CONFIG = {
  MAX_FRIEND_REQUESTS_PER_DAY: 20,
  MAX_FRIENDS: 500,
  MAX_GROUP_MEMBERS: 15,
  MAX_GROUPS_PER_USER: 10,
  MAX_REFERRALS_PER_DAY: 5,
  MAX_MESSAGE_LENGTH: 2000,
  MESSAGE_LOAD_LIMIT: 50,
  LEADERBOARD_PAGE_SIZE: 100,
  XP_PER_LEVEL: 100,
};

export const FEATURES = {
  SOCIAL: true,
  CHAT: true,
  STUDY_GROUPS: true,
  REFERRALS: true,
  LEADERBOARD: true,
  ACHIEVEMENTS: true,
  QR_CODE_SHARING: true,
};
