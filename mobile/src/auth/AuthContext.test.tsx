import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

jest.mock("../api/client", () => ({
  attachAuthHandlers: jest.fn(),
}));

jest.mock("../api/services", () => ({
  authApi: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
    guestSession: jest.fn(),
  },
  userApi: {
    me: jest.fn(),
  },
}));

jest.mock("../services/monitoringService", () => ({
  __esModule: true,
  default: {
    setUser: jest.fn(),
    trackEvent: jest.fn(),
  },
}));

jest.mock("../services/firebaseAnalyticsService", () => ({
  __esModule: true,
  default: {
    setUserId: jest.fn(),
  },
}));

jest.mock("../services/notificationService", () => ({
  __esModule: true,
  default: {
    syncPushTokenWithServer: jest.fn(),
    unregisterPushTokenFromServer: jest.fn(),
  },
}));

jest.mock("./storage", () => ({
  persistAuth: jest.fn(),
  loadAuth: jest.fn(),
  clearAuth: jest.fn(),
}));

jest.mock("jwt-decode", () => ({
  jwtDecode: jest.fn(() => ({
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    sub: "user-1",
  })),
}));

jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const { authApi, userApi } = require("../api/services");
const storage = require("./storage");
const apiClient = require("../api/client");
const { AuthProvider, useAuth } = require("./AuthContext");

const buildAuthResponse = () => ({
  accessToken: "access-token",
  refreshToken: "refresh-token",
  user: {
    _id: "user-1",
    email: "learner@example.com",
    firstName: "Test",
    lastName: "Learner",
    emailVerified: true,
    subscriptionPlan: "free" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
});

describe("AuthProvider mobile smoke flows", () => {
  let authState: any = null;

  const Capture = () => {
    authState = useAuth();
    return null;
  };

  beforeEach(() => {
    authState = null;
    jest.clearAllMocks();
    storage.loadAuth.mockResolvedValue(null);
    storage.clearAuth.mockResolvedValue(undefined);
    storage.persistAuth.mockResolvedValue(undefined);
    authApi.logout.mockResolvedValue(undefined);
  });

  it("supports login journey and persists session tokens", async () => {
    const response = buildAuthResponse();
    authApi.login.mockResolvedValue(response);

    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>
    );

    await waitFor(() => expect(authState?.initializing).toBe(false));

    await act(async () => {
      await authState.login("learner@example.com", "password");
    });

    expect(authApi.login).toHaveBeenCalledWith({
      email: "learner@example.com",
      password: "password",
    });
    expect(storage.persistAuth).toHaveBeenCalledWith({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    expect(authState?.user?.email).toBe("learner@example.com");
    expect(authState?.accessToken).toBe("access-token");
    expect(apiClient.attachAuthHandlers).toHaveBeenCalled();
  });

  it("restores an existing session from storage on app startup", async () => {
    const response = buildAuthResponse();
    storage.loadAuth.mockResolvedValue({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });
    userApi.me.mockResolvedValue(response.user);

    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>
    );

    await waitFor(() => expect(authState?.initializing).toBe(false));
    await waitFor(() => expect(authState?.user?._id).toBe("user-1"));
    expect(userApi.me).toHaveBeenCalledTimes(1);
    expect(authState?.refreshToken).toBe("refresh-token");
  });

  it("supports logout journey and clears local session state", async () => {
    const response = buildAuthResponse();
    authApi.login.mockResolvedValue(response);

    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>
    );

    await waitFor(() => expect(authState?.initializing).toBe(false));

    await act(async () => {
      await authState.login("learner@example.com", "password");
    });

    await act(async () => {
      await authState.logout();
    });

    expect(authApi.logout).toHaveBeenCalledWith("refresh-token");
    expect(storage.clearAuth).toHaveBeenCalled();
    expect(authState?.user).toBeNull();
    expect(authState?.accessToken).toBeNull();
    expect(authState?.refreshToken).toBeNull();
  });
});
