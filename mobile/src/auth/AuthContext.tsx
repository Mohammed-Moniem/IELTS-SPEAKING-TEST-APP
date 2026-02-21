import Constants from "expo-constants";
import { jwtDecode } from "jwt-decode";
import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { attachAuthHandlers } from "../api/client";
import { authApi, userApi } from "../api/services";
import firebaseAnalyticsService from "../services/firebaseAnalyticsService";
import monitoringService from "../services/monitoringService";
import notificationService from "../services/notificationService";
import { AuthResponse, User } from "../types/api";
import { logger } from "../utils/logger";
import { clearAuth, loadAuth, persistAuth } from "./storage";

type JWTPayload = {
  exp: number;
  iat: number;
  sub: string;
};

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    referralCode?: string;
  }) => Promise<void>;
  logout: (options?: { skipServer?: boolean }) => Promise<void>;
  refreshProfile: () => Promise<User | null>;
  setUser: (user: User) => void;
  startGuestSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const extractTokens = (
  payload: Pick<AuthResponse, "accessToken" | "refreshToken">
) => ({
  accessToken: payload.accessToken,
  refreshToken: payload.refreshToken,
});

const extraConfig = (Constants.expoConfig?.extra ||
  {}) as Record<string, string | undefined>;
const FALLBACK_GUEST_EMAIL =
  process.env.EXPO_PUBLIC_GUEST_EMAIL || extraConfig.guestEmail || "";
const FALLBACK_GUEST_PASSWORD =
  process.env.EXPO_PUBLIC_GUEST_PASSWORD || extraConfig.guestPassword || "";

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const tokensRef = useRef<{
    accessToken: string | null;
    refreshToken: string | null;
  } | null>(null);

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshTokensRef = useRef<(() => Promise<any>) | null>(null);
  const isRefreshingRef = useRef<boolean>(false);
  const refreshPromiseRef = useRef<Promise<any> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  const scheduleTokenRefresh = useCallback(
    (token: string) => {
      clearRefreshTimer();

      try {
        const decoded = jwtDecode<JWTPayload>(token);
        const expiresAt = decoded.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        const expiresIn = expiresAt - now;

        // Schedule refresh 1 minute before expiry (or immediately if less than 1 min remains)
        const refreshIn = Math.max(0, expiresIn - 60000);

        if (refreshIn > 0) {
          logger.info(
            "🔄",
            `Token refresh scheduled in ${Math.round(refreshIn / 1000)}s`
          );

          refreshTimeoutRef.current = setTimeout(async () => {
            logger.info("🔄", "Auto-refreshing token...");
            if (refreshTokensRef.current) {
              await refreshTokensRef.current();
            }
          }, refreshIn);
        } else {
          logger.warn("⚠️", "Token expires soon, refreshing immediately...");
          if (refreshTokensRef.current) {
            void refreshTokensRef.current();
          }
        }
      } catch (error) {
        logger.error(
          "❌",
          "Failed to decode token for refresh scheduling:",
          error
        );
      }
    },
    [clearRefreshTimer]
  );

  type SessionOptions = {
    isGuest?: boolean;
    persist?: boolean;
  };

  const setSession = useCallback(
    async (payload: AuthResponse, options?: SessionOptions) => {
      const tokens = extractTokens(payload);
      setAccessToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken);
      tokensRef.current = tokens;
      const sessionUser = options?.isGuest
        ? { ...payload.user, isGuest: true }
        : payload.user;
      setUserState(sessionUser);
      monitoringService.setUser(sessionUser);
      monitoringService.trackEvent("auth_session_established", {
        userId: sessionUser._id,
        plan: sessionUser.subscriptionPlan,
        mode: options?.isGuest ? "guest" : "standard",
      });
      if (options?.persist === false) {
        await clearAuth();
      } else {
        await persistAuth(tokens);
      }

      // Schedule automatic token refresh
      scheduleTokenRefresh(tokens.accessToken);
      // Inform analytics
      void firebaseAnalyticsService.setUserId(sessionUser._id);
      void notificationService.syncPushTokenWithServer();
    },
    [scheduleTokenRefresh]
  );

  const clearSession = useCallback(async () => {
    clearRefreshTimer();
    tokensRef.current = { accessToken: null, refreshToken: null };
    setAccessToken(null);
    setRefreshToken(null);
    setUserState(null);
    monitoringService.trackEvent("auth_session_cleared");
    monitoringService.setUser(null);
    void firebaseAnalyticsService.setUserId(null);
    await clearAuth();
  }, [clearRefreshTimer]);

  const logout = useCallback(
    async (options?: { skipServer?: boolean }) => {
      const refresh = tokensRef.current?.refreshToken;
      if (!options?.skipServer && refresh) {
        try {
          await authApi.logout(refresh);
        } catch (error) {
          logger.warn("⚠️", "Logout request failed", error);
        }
      }
      void notificationService.unregisterPushTokenFromServer();
      await clearSession();
    },
    [clearSession]
  );

  const refreshTokens = useCallback(async () => {
    // If already refreshing, return the existing promise
    if (isRefreshingRef.current && refreshPromiseRef.current) {
      logger.info("🔄", "Refresh already in progress, waiting...");
      return refreshPromiseRef.current;
    }

    const storedRefresh = tokensRef.current?.refreshToken;
    if (!storedRefresh) {
      await logout({ skipServer: true });
      return null;
    }

    // Set refreshing flag and create promise
    isRefreshingRef.current = true;
    const refreshPromise = (async () => {
      try {
        logger.info("🔄", "Starting token refresh...");
        const refreshed = await authApi.refresh(storedRefresh);
        await setSession(refreshed);
        logger.info("✅", "Token refresh successful");
        return extractTokens(refreshed);
      } catch (error: any) {
        const errorMessage =
          error?.response?.data?.message || error?.message || "Unknown error";
        const errorCode = error?.response?.data?.code;

        if (errorCode === "RefreshTokenRevoked") {
          logger.warn("⚠️", "Session expired. Please log in again.");
        } else {
          logger.warn("⚠️", "Token refresh failed:", errorMessage);
        }

        await logout({ skipServer: true });
        return null;
      } finally {
        isRefreshingRef.current = false;
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [logout, setSession]);

  // Update ref when refreshTokens changes
  useEffect(() => {
    refreshTokensRef.current = refreshTokens;
  }, [refreshTokens]);

  useEffect(() => {
    attachAuthHandlers({
      getAccessToken: () => tokensRef.current?.accessToken || null,
      getRefreshToken: () => tokensRef.current?.refreshToken || null,
      refreshTokens,
      onUnauthorized: () => {
        void logout({ skipServer: true });
      },
    });

    return () => attachAuthHandlers(null);
  }, [logout, refreshTokens]);

  useEffect(() => {
    tokensRef.current = { accessToken, refreshToken };
  }, [accessToken, refreshToken]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await loadAuth();
        if (stored && mounted) {
          tokensRef.current = stored;
          setAccessToken(stored.accessToken);
          setRefreshToken(stored.refreshToken);
          try {
            const profile = await userApi.me();
            if (mounted) {
              setUserState(profile);
              monitoringService.setUser(profile);
              monitoringService.trackEvent("auth_session_restored", {
                userId: profile._id,
                plan: profile.subscriptionPlan,
              });
              // Schedule token refresh for restored session
              scheduleTokenRefresh(stored.accessToken);
              void firebaseAnalyticsService.setUserId(profile._id);
            }
          } catch (error) {
            logger.warn("⚠️", "Failed to fetch profile during restore", error);
            await logout({ skipServer: true });
          }
        }
      } finally {
        if (mounted) {
          setInitializing(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [logout, scheduleTokenRefresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await authApi.login({ email, password });
      await setSession(response);
    },
    [setSession]
  );

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
      referralCode?: string;
    }) => {
      const response = await authApi.register(payload);
      await setSession(response);
    },
    [setSession]
  );

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await userApi.me();
      setUserState(profile);
      monitoringService.setUser(profile);
      return profile;
    } catch (error) {
      logger.warn("⚠️", "Failed to refresh profile", error);
      return null;
    }
  }, []);

  const setUser = useCallback((updatedUser: User) => {
    setUserState(updatedUser);
    monitoringService.setUser(updatedUser);
  }, []);

  const startGuestSession = useCallback(async () => {
    const applyGuestSession = async (response: AuthResponse) => {
      await setSession(
        {
          ...response,
          user: {
            ...response.user,
            isGuest: true,
          },
        },
        { isGuest: true, persist: false }
      );
    };

    const tryFallbackLogin = async () => {
      if (!FALLBACK_GUEST_EMAIL || !FALLBACK_GUEST_PASSWORD) {
        return null;
      }
      const fallbackResponse = await authApi.login({
        email: FALLBACK_GUEST_EMAIL,
        password: FALLBACK_GUEST_PASSWORD,
      });
      monitoringService.trackEvent("guest_session_fallback_used", {
        mode: "env_credentials",
      });
      return fallbackResponse;
    };

    const registerEphemeralGuest = async () => {
      const randomSuffix = Math.random().toString(36).slice(-6);
      const email = `guest+${Date.now()}-${randomSuffix}@trial.local`;
      const password = `Guest!${Math.random().toString(36).slice(-8)}`;
      const response = await authApi.register({
        email,
        password,
        firstName: "Guest",
        lastName: "User",
      });
      monitoringService.trackEvent("guest_session_fallback_used", {
        mode: "ephemeral_register",
      });
      return response;
    };

    try {
      const response = await authApi.guestSession();
      await applyGuestSession(response);
      return;
    } catch (error: any) {
      try {
        const fallbackResponse =
          (await tryFallbackLogin()) ?? (await registerEphemeralGuest());
        await applyGuestSession(fallbackResponse);
      } catch (fallbackError) {
        logger.error("Guest fallback flow failed", fallbackError);
        throw (fallbackError ?? error);
      }
    }
  }, [setSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      refreshToken,
      initializing,
      login,
      register,
      logout,
      refreshProfile,
      setUser,
      startGuestSession,
    }),
    [
      user,
      accessToken,
      refreshToken,
      initializing,
      login,
      register,
      logout,
      refreshProfile,
      setUser,
      startGuestSession,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
