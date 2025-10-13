import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";

import { AuthResponse, StandardResponse } from "../types/api";

const defaultApiUrl = "https://1c3c16b4d101.ngrok-free.app/api/v1";

export const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  defaultApiUrl;

// Log the API URL for debugging
console.log("🌐 API Base URL:", API_URL);

type RefreshResult = Pick<AuthResponse, "accessToken" | "refreshToken">;

type AuthHandlers = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  refreshTokens: () => Promise<RefreshResult | null>;
  onUnauthorized: () => void;
};

let authHandlers: AuthHandlers | null = null;

export const attachAuthHandlers = (handlers: AuthHandlers | null) => {
  authHandlers = handlers;
};

interface RetriableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-api-key": "local-dev-api-key", // Add API key from backend .env
  },
  // Evaluations and ElevenLabs synthesis can take longer than 30s, especially on first run
  timeout: 120000,
});

apiClient.interceptors.request.use((config) => {
  // Log requests in development
  if (__DEV__) {
    console.log("📤 API Request:", {
      method: config.method?.toUpperCase(),
      url: config.url,
      fullURL: `${config.baseURL}${config.url}`,
      headers: config.headers,
    });
  }

  if (!authHandlers) return config;
  const token = authHandlers.getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    // Log successful responses in development (excluding large data payloads)
    if (__DEV__) {
      // Don't log response data for speech synthesis (contains large base64 audio)
      const isSpeechSynthesis =
        response.config.url?.includes("/speech/synthesize");

      console.log("✅ API Response:", {
        status: response.status,
        url: response.config.url,
        ...(isSpeechSynthesis
          ? { note: "Speech synthesis response (audio data not logged)" }
          : { data: response.data }),
      });
    }
    return response;
  },
  async (error) => {
    // Enhanced error logging
    if (__DEV__) {
      console.error("❌ API Error:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        fullURL: error.config
          ? `${error.config.baseURL}${error.config.url}`
          : "unknown",
        responseData: error.response?.data,
        requestHeaders: error.config?.headers,
      });

      // Network error specific logging
      if (error.message === "Network Error") {
        console.error("🔴 NETWORK ERROR - Check:");
        console.error("1. Backend running on", API_URL, "?");
        console.error("2. Mobile and computer on same WiFi?");
        console.error("3. Firewall blocking port 4000?");
      }
    }

    const status = error.response?.status;
    const request: RetriableRequest | undefined = error.config;

    if (status === 401 && request && !request._retry && authHandlers) {
      if (!authHandlers.getRefreshToken()) {
        authHandlers.onUnauthorized();
        return Promise.reject(error);
      }

      request._retry = true;
      try {
        const refreshed = await authHandlers.refreshTokens();
        if (!refreshed) {
          authHandlers.onUnauthorized();
          return Promise.reject(error);
        }

        request.headers = request.headers || {};
        request.headers.Authorization = `Bearer ${refreshed.accessToken}`;
        return apiClient(request);
      } catch (refreshError) {
        authHandlers.onUnauthorized();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error as AxiosError);
  }
);

export const unwrap = async <T>(
  promise: Promise<{ data: StandardResponse<T> }>
): Promise<T> => {
  const response = await promise;
  if (!response.data.success) {
    const { message } = response.data;
    const errorMessage = Array.isArray(message)
      ? message.join(", ")
      : message || "Request failed";
    throw new Error(errorMessage);
  }
  return response.data.data as T;
};
