'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { apiRequest } from '@/lib/api/client';
import { clearStoredSession, loadStoredSession, saveStoredSession, StoredSession } from '@/lib/auth/session';
import { AuthResult, AuthUser } from '@/lib/types';

type RegisterPayload = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  hydrateFromStorage: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const toStoredSession = (result: AuthResult): StoredSession => ({
  accessToken: result.accessToken,
  refreshToken: result.refreshToken,
  user: result.user
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrateFromStorage = useCallback(() => {
    const session = loadStoredSession();
    if (!session) {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
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

  const persist = useCallback((result: AuthResult) => {
    const session = toStoredSession(result);
    saveStoredSession(session);
    setUser(result.user);
    setAccessToken(result.accessToken);
    setRefreshToken(result.refreshToken);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiRequest<AuthResult>('/auth/login', {
        method: 'POST',
        authOptional: true,
        body: JSON.stringify({ email, password })
      });
      persist(result);
    },
    [persist]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const result = await apiRequest<AuthResult>('/auth/register', {
        method: 'POST',
        authOptional: true,
        body: JSON.stringify(payload)
      });
      persist(result);
    },
    [persist]
  );

  const logout = useCallback(async () => {
    try {
      if (refreshToken) {
        await apiRequest('/auth/logout', {
          method: 'POST',
          token: accessToken || undefined,
          body: JSON.stringify({ refreshToken })
        });
      }
    } catch {
      // Logout should still clear local session on failure.
    }

    clearStoredSession();
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  }, [accessToken, refreshToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      refreshToken,
      isLoading,
      isAuthenticated: !!(user && accessToken),
      login,
      register,
      logout,
      hydrateFromStorage
    }),
    [user, accessToken, refreshToken, isLoading, login, register, logout, hydrateFromStorage]
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
