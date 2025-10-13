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
import { AuthResponse, User } from "../types/api";
import { clearAuth, loadAuth, persistAuth } from "./storage";

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
  }) => Promise<void>;
  logout: (options?: { skipServer?: boolean }) => Promise<void>;
  refreshProfile: () => Promise<User | null>;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const extractTokens = (
  payload: Pick<AuthResponse, "accessToken" | "refreshToken">
) => ({
  accessToken: payload.accessToken,
  refreshToken: payload.refreshToken,
});

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const tokensRef = useRef<{
    accessToken: string | null;
    refreshToken: string | null;
  } | null>(null);

  const setSession = useCallback(async (payload: AuthResponse) => {
    const tokens = extractTokens(payload);
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    tokensRef.current = tokens;
    setUserState(payload.user);
    await persistAuth(tokens);
  }, []);

  const clearSession = useCallback(async () => {
    tokensRef.current = { accessToken: null, refreshToken: null };
    setAccessToken(null);
    setRefreshToken(null);
    setUserState(null);
    await clearAuth();
  }, []);

  const logout = useCallback(
    async (options?: { skipServer?: boolean }) => {
      const refresh = tokensRef.current?.refreshToken;
      if (!options?.skipServer && refresh) {
        try {
          await authApi.logout(refresh);
        } catch (error) {
          console.warn("Logout request failed", error);
        }
      }
      await clearSession();
    },
    [clearSession]
  );

  const refreshTokens = useCallback(async () => {
    const storedRefresh = tokensRef.current?.refreshToken;
    if (!storedRefresh) {
      await logout({ skipServer: true });
      return null;
    }

    try {
      const refreshed = await authApi.refresh(storedRefresh);
      await setSession(refreshed);
      return extractTokens(refreshed);
    } catch (error) {
      console.warn("Unable to refresh token, clearing session", error);
      await logout({ skipServer: true });
      return null;
    }
  }, [logout, setSession]);

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
            }
          } catch (error) {
            console.warn("Failed to fetch profile during restore", error);
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
  }, [logout]);

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
      return profile;
    } catch (error) {
      console.warn("Failed to refresh profile", error);
      return null;
    }
  }, []);

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
      setUser: setUserState,
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
