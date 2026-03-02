import { AxiosResponse } from "axios";

import {
  AuthResponse,
  NotificationSettings,
  PracticeSession,
  PracticeSessionStart,
  Preferences,
  SimulationStart,
  StandardResponse,
  StripeConfig,
  SubscriptionInfo,
  TestSimulation,
  Topic,
  UsageSummary,
  User,
} from "../types/api";
import { apiClient, unwrap } from "./client";

type ApiResponse<T> = AxiosResponse<StandardResponse<T>>;

export const authApi = {
  register: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    referralCode?: string;
    partnerCode?: string;
  }) => unwrap<AuthResponse>(apiClient.post("/auth/register", payload)),
  login: (payload: { email: string; password: string }) =>
    unwrap<AuthResponse>(apiClient.post("/auth/login", payload)),
  refresh: (refreshToken: string) =>
    unwrap<AuthResponse>(apiClient.post("/auth/refresh", { refreshToken })),
  logout: (refreshToken: string) =>
    unwrap<void>(apiClient.post("/auth/logout", { refreshToken })),
  guestSession: () =>
    unwrap<AuthResponse>(apiClient.post("/auth/guest-session")),
};

export const userApi = {
  me: () => unwrap<User>(apiClient.get("/users/me")),
  updateProfile: (payload: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    appTheme?: string;
  }) => unwrap<User>(apiClient.patch("/users/me", payload)),
};

export const usageApi = {
  summary: () => unwrap<UsageSummary>(apiClient.get("/usage/summary")),
};

export const topicApi = {
  list: () => unwrap<Topic[]>(apiClient.get("/topics/")),
  getPractice: (params?: {
    limit?: number;
    offset?: number;
    excludeCompleted?: boolean;
    category?: "part1" | "part2" | "part3";
  }) =>
    unwrap<{
      topics: Topic[];
      total: number;
      hasMore: boolean;
      limit: number;
      offset: number;
    }>(apiClient.get("/topics/practice", { params })),
  generateAITopics: (params?: {
    count?: number;
    difficulty?: "beginner" | "intermediate" | "advanced";
    part?: 1 | 2 | 3;
  }) =>
    unwrap<{
      topics: Topic[];
      generated: number;
    }>(apiClient.post("/topics/generate", params)),
};

export const practiceApi = {
  startSession: (topicId: string) =>
    unwrap<PracticeSessionStart>(
      apiClient.post("/practice/sessions", { topicId })
    ),
  completeSession: (
    sessionId: string,
    payload: { userResponse?: string; timeSpent?: number }
  ) =>
    unwrap<PracticeSession>(
      apiClient.post(`/practice/sessions/${sessionId}/complete`, payload)
    ),
  uploadAudio: async (
    sessionId: string,
    audioUri: string,
    onProgress?: (progress: number) => void
  ): Promise<PracticeSession & { transcription?: any }> => {
    const formData = new FormData();

    // Get file info
    const fileInfo = await fetch(audioUri);
    const blob = await fileInfo.blob();

    // Append audio file to form data
    formData.append("audio", {
      uri: audioUri,
      type: "audio/m4a",
      name: `audio_${sessionId}_${Date.now()}.m4a`,
    } as any);

    return unwrap<PracticeSession & { transcription?: any }>(
      apiClient.post(`/practice/sessions/${sessionId}/audio`, formData, {
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            onProgress(progress);
          }
        },
      })
    );
  },
  listSessions: (params?: {
    limit?: number;
    offset?: number;
    topicId?: string;
  }) =>
    unwrap<PracticeSession[]>(apiClient.get("/practice/sessions", { params })),
};

export const simulationApi = {
  start: () => unwrap<SimulationStart>(apiClient.post("/test-simulations/")),
  complete: (
    simulationId: string,
    parts: {
      part: number;
      question: string;
      response?: string;
      timeSpent?: number;
    }[]
  ) =>
    unwrap<TestSimulation>(
      apiClient.post(`/test-simulations/${simulationId}/complete`, { parts })
    ),
  list: (params?: { limit?: number; offset?: number }) =>
    unwrap<TestSimulation[]>(apiClient.get("/test-simulations/", { params })),
  detail: (simulationId: string) =>
    unwrap<TestSimulation>(apiClient.get(`/test-simulations/${simulationId}`)),
};

export const preferencesApi = {
  get: () => unwrap<Preferences | null>(apiClient.get("/preferences/")),
  upsert: (payload: {
    testDate?: string;
    targetBand?: string;
    timeFrame?: string;
  }) => unwrap<Preferences>(apiClient.put("/preferences/", payload)),
};

export const subscriptionApi = {
  current: () =>
    unwrap<SubscriptionInfo>(apiClient.get("/subscription/current")),
  checkout: (payload: {
    planType: "premium" | "pro";
    couponCode?: string;
    partnerCode?: string;
    successUrl?: string;
    cancelUrl?: string;
  }) =>
    unwrap<{
      sessionId: string;
      checkoutUrl?: string | null;
      publishableKey?: string | null;
    }>(apiClient.post("/subscription/checkout", payload)),
  config: () => unwrap<StripeConfig>(apiClient.get("/subscription/config")),
};

export const notificationsApi = {
  getPreferences: () =>
    unwrap<NotificationSettings>(apiClient.get("/notifications/preferences")),
  updatePreferences: (payload: NotificationSettings) =>
    unwrap<NotificationSettings>(
      apiClient.put("/notifications/preferences", payload)
    ),
  registerDevice: (token: string) =>
    unwrap<void>(apiClient.post("/notifications/device", { token })),
  unregisterDevice: (token: string) =>
    unwrap<void>(
      apiClient.delete("/notifications/device", {
        data: { token },
      })
    ),
};
