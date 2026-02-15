import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
} from "axios";

import { API_BASE_URL, API_KEY } from "../config";
import { AuthResponse, StandardResponse } from "../types/api";
import { logger } from "../utils/logger";
import { rateLimiter } from "../utils/rateLimiter";

export const API_URL = API_BASE_URL;
export { API_KEY };

// Log the API URL for debugging
logger.info("🌐", "API Base URL:", API_URL);

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

export const getAuthToken = (): string | null => {
  return authHandlers?.getAccessToken() || null;
};

interface RetriableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: "application/json",
    "x-api-key": API_KEY, // Add API key from backend .env
  },
  // Evaluations and ElevenLabs synthesis can take longer than 30s, especially on first run
  timeout: 120000,
  // Prevent axios from transforming FormData
  transformRequest: [
    (data, headers) => {
      // If it's FormData, don't transform it and let React Native handle it
      const isFormData =
        (typeof FormData !== "undefined" && data instanceof FormData) ||
        (data &&
          typeof data === "object" &&
          typeof (data as any).append === "function" &&
          (typeof (data as any)._parts !== "undefined" ||
            typeof (data as any).getParts === "function"));

      if (isFormData) {
        // Critical: Remove Content-Type so React Native can set it with boundary
        if (headers) {
          delete headers["Content-Type"];
          delete headers["content-type"];
        }
        return data;
      }

      // For other data, use default JSON transformation
      if (data && typeof data === "object") {
        if (headers) {
          headers["Content-Type"] = "application/json";
        }
        return JSON.stringify(data);
      }
      return data;
    },
  ],
});

const isLikelyFormData = (value: any): boolean => {
  if (!value) return false;

  const globalFormData =
    typeof FormData !== "undefined" ? (FormData as any) : null;

  if (globalFormData && value instanceof globalFormData) {
    return true;
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  const maybeForm = value as {
    append?: unknown;
    _parts?: unknown;
    getParts?: () => unknown;
  };

  return (
    typeof maybeForm.append === "function" &&
    (Array.isArray(maybeForm._parts) ||
      typeof maybeForm.getParts === "function")
  );
};

apiClient.interceptors.request.use(async (config) => {
  const method = config.method?.toUpperCase() || "GET";
  const endpoint = config.url?.split("?")[0] || "unknown";
  const key = `${method}:${endpoint}`;

  await rateLimiter.schedule(key);

  // Log requests in development
  if (__DEV__) {
    logger.apiRequest(method, config.url || "unknown", {
      fullURL: config.url?.startsWith("http")
        ? config.url
        : `${config.baseURL || API_URL}${config.url}`,
      headers: config.headers,
    });
  }

  if (!authHandlers) return config;
  const token = authHandlers.getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  const isFormData =
    (typeof FormData !== "undefined" && config.data instanceof FormData) ||
    (config.data &&
      typeof config.data === "object" &&
      typeof (config.data as any).append === "function" &&
      typeof (config.data as any)._parts !== "undefined");

  if (isFormData || isLikelyFormData(config.data)) {
    logger.debug(
      "🔧 Interceptor detected FormData, removing Content-Type header"
    );
    const headers = config.headers;

    const deleteHeader = (key: string) => {
      if (!headers) return;
      if (headers instanceof AxiosHeaders) {
        headers.delete(key);
      } else if (typeof (headers as any).delete === "function") {
        (headers as any).delete(key);
      } else {
        delete (headers as any)[key];
      }
    };

    // Remove Content-Type so React Native can set it with the proper boundary
    deleteHeader("Content-Type");
    deleteHeader("content-type");

    logger.debug("🔧 Headers after cleanup:", config.headers);

    // Ensure Accept header is set
    if (headers instanceof AxiosHeaders) {
      if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
      }
    } else {
      const headerBag = headers as Record<string, unknown> | undefined;
      if (headerBag) {
        const acceptHeader =
          (headerBag as any)?.accept ?? (headerBag as any)?.Accept;
        if (!acceptHeader) {
          (headerBag as any).Accept = "application/json";
        }
      }
    }
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

      logger.apiResponse(
        response.status,
        response.config.url || "unknown",
        isSpeechSynthesis
          ? { note: "Speech synthesis response (audio data not logged)" }
          : response.data
      );
    }
    return response;
  },
  async (error) => {
    // Enhanced error logging
    if (__DEV__) {
      logger.apiError(error);

      // Network error specific logging
      if (error.message === "Network Error") {
        logger.error("🔴 NETWORK ERROR - Check:");
        logger.error("1. Backend running on", API_URL, "?");
        logger.error("2. Mobile and computer on same WiFi?");
        logger.error("3. Firewall blocking port 4000?");
      }
    }

    const status = error.response?.status;
    const request: RetriableRequest | undefined = error.config;

    if (status === 401 && request && !request._retry && authHandlers) {
      const refreshToken = authHandlers.getRefreshToken();
      if (!refreshToken) {
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
  promise: Promise<{ data: any }>
): Promise<T> => {
  const response = await promise;
  const payload = response.data as StandardResponse<T> & {
    error?: { message?: string; code?: string };
    errors?: Array<{ message?: string }>;
  };

  if (!payload?.success) {
    const messageFromError =
      typeof (payload as any)?.error?.message === "string"
        ? (payload as any).error.message
        : undefined;
    const messageFromErrors = Array.isArray((payload as any)?.errors)
      ? (payload as any).errors
          .map((e: any) => (typeof e?.message === "string" ? e.message : ""))
          .filter((m: string) => m.trim().length > 0)
          .join(", ")
      : undefined;
    const messageFromMessage = Array.isArray((payload as any)?.message)
      ? (payload as any).message.join(", ")
      : typeof (payload as any)?.message === "string"
      ? (payload as any).message
      : undefined;

    const errorMessage =
      messageFromError ||
      messageFromErrors ||
      messageFromMessage ||
      (typeof (payload as any)?.error === "string" ? (payload as any).error : undefined) ||
      "Request failed";

    const error = new Error(errorMessage);
    (error as any).code = (payload as any)?.error?.code;
    (error as any).status = (payload as any)?.status;
    throw error;
  }
  return (payload as any).data as T;
};
