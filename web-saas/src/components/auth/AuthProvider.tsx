'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

import { apiRequest, registerApiAuthHandlers } from '@/lib/api/client';
import firebaseAnalyticsService from '@/lib/analytics/firebaseAnalyticsService';
import {
  clearStoredSession,
  getStoredRefreshToken,
  loadStoredSession,
  saveStoredSession,
  StoredSession
} from '@/lib/auth/session';
import { AppConfig, AuthResult, AuthUser } from '@/lib/types';

type RegisterPayload = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string;
  referralCode?: string;
  partnerCode?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  appConfig: AppConfig | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  refreshAppConfig: () => Promise<void>;
  hydrateFromStorage: () => void;
  clearSessionError: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const toStoredSession = (result: AuthResult): StoredSession => ({
  accessToken: result.accessToken,
  refreshToken: result.refreshToken,
  user: result.user
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const clearSessionState = useCallback((message?: string) => {
    clearStoredSession();
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    setAppConfig(null);
    if (message) {
      setSessionError(message);
    }
  }, []);

  const persist = useCallback((result: AuthResult) => {
    const session = toStoredSession(result);
    saveStoredSession(session);
    setUser(result.user);
    setAccessToken(result.accessToken);
    setRefreshToken(result.refreshToken);
    setSessionError(null);
  }, []);

  const loadConfig = useCallback(async (tokenOverride?: string) => {
    const data = await apiRequest<AppConfig>('/app/config', {
      token: tokenOverride || undefined
    });
    setAppConfig(data);

    // Keep user plan and roles aligned with server bootstrap payload.
    setUser(prev =>
      prev
        ? {
            ...prev,
            subscriptionPlan: data.subscriptionPlan,
            adminRoles: (data.roles || []) as AuthUser['adminRoles']
          }
        : prev
    );
  }, []);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    const token = refreshToken || getStoredRefreshToken();
    if (!token) {
      clearSessionState('Your session has expired. Please sign in again.');
      return null;
    }

    try {
      const refreshed = await apiRequest<AuthResult>('/auth/refresh', {
        method: 'POST',
        authOptional: true,
        retryOnUnauthorized: false,
        body: JSON.stringify({ refreshToken: token })
      });

      persist(refreshed);
      await loadConfig(refreshed.accessToken);
      return refreshed.accessToken;
    } catch {
      clearSessionState('Your session is no longer valid. Please sign in again.');
      return null;
    }
  }, [clearSessionState, loadConfig, persist, refreshToken]);

  const refreshAppConfig = useCallback(async () => {
    if (!accessToken) return;
    try {
      await loadConfig(accessToken);
    } catch {
      // Do not block UI on config refresh errors.
    }
  }, [accessToken, loadConfig]);

  const hydrateFromStorage = useCallback(() => {
    const session = loadStoredSession();
    if (!session) {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      setAppConfig(null);
      return;
    }

    setUser(session.user);
    setAccessToken(session.accessToken);
    setRefreshToken(session.refreshToken);
  }, []);

  useEffect(() => {
    hydrateFromStorage();
    setIsLoading(false);
  }, [hydrateFromStorage]);

  useEffect(() => {
    void firebaseAnalyticsService.initialize();
  }, []);

  useEffect(() => {
    registerApiAuthHandlers({
      getAccessToken: () => accessToken,
      refreshAccessToken: refreshSession,
      onSessionExpired: () => clearSessionState('Your session has expired. Please sign in again.')
    });
  }, [accessToken, clearSessionState, refreshSession]);

  useEffect(() => {
    if (!accessToken) return;

    void (async () => {
      try {
        await loadConfig(accessToken);
      } catch {
        await refreshSession();
      }
    })();
  }, [accessToken, loadConfig, refreshSession]);

  useEffect(() => {
    void firebaseAnalyticsService.setUserId(user?._id || null);
    if (!user) return;

    const roleValue = user.adminRoles?.length ? user.adminRoles.join(',') : undefined;
    void firebaseAnalyticsService.setUserProperties({
      plan: user.subscriptionPlan,
      roles: roleValue
    });
  }, [user, user?._id, user?.subscriptionPlan, user?.adminRoles]);

  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    // Guard against rare client/router transitional states where pathname can be empty.
    const safePathname = pathname || '/';
    const route = search ? `${safePathname}${search}` : safePathname;
    const routeArea = route.startsWith('/admin')
      ? 'admin'
      : route.startsWith('/app/advertiser')
        ? 'advertiser'
        : route.startsWith('/app')
          ? 'learner'
          : 'marketing';

    void firebaseAnalyticsService.trackScreen(route, {
      route_area: routeArea
    });
  }, [pathname]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiRequest<AuthResult>('/auth/login', {
        method: 'POST',
        authOptional: true,
        retryOnUnauthorized: false,
        body: JSON.stringify({ email, password })
      });

      persist(result);
      await loadConfig(result.accessToken);
    },
    [loadConfig, persist]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const result = await apiRequest<AuthResult>('/auth/register', {
        method: 'POST',
        authOptional: true,
        retryOnUnauthorized: false,
        body: JSON.stringify(payload)
      });

      persist(result);
      await loadConfig(result.accessToken);
    },
    [loadConfig, persist]
  );

  const logout = useCallback(async () => {
    try {
      const token = refreshToken || getStoredRefreshToken();
      if (token) {
        await apiRequest('/auth/logout', {
          method: 'POST',
          token: accessToken || undefined,
          retryOnUnauthorized: false,
          authOptional: true,
          body: JSON.stringify({ refreshToken: token })
        });
      }
    } catch {
      // Clear local session even if remote logout fails.
    }

    clearSessionState();
  }, [accessToken, clearSessionState, refreshToken]);

  const clearSessionError = useCallback(() => setSessionError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      refreshToken,
      appConfig,
      isLoading,
      isAuthenticated: !!(user && accessToken),
      sessionError,
      login,
      register,
      logout,
      refreshSession,
      refreshAppConfig,
      hydrateFromStorage,
      clearSessionError
    }),
    [
      user,
      accessToken,
      refreshToken,
      appConfig,
      isLoading,
      sessionError,
      login,
      register,
      logout,
      refreshSession,
      refreshAppConfig,
      hydrateFromStorage,
      clearSessionError
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
