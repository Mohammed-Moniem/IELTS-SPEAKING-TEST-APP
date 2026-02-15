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
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { attachAuthHandlers } from "../api/client";
import { userApi } from "../api/services";
import firebaseAnalyticsService from "../services/firebaseAnalyticsService";
import monitoringService from "../services/monitoringService";
import notificationService from "../services/notificationService";
import { User } from "../types/api";
import { logger } from "../utils/logger";
import { supabase } from "../lib/supabase";

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  initializing: boolean;

  startGuestSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    referralCode?: string;
  }) => Promise<void>;
  upgradeGuest: (payload: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    referralCode?: string;
  }) => Promise<void>;
  continueWithGoogle: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (_token: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;

  refreshProfile: () => Promise<User | null>;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const buildPlaceholderUser = (params: {
  id: string;
  email?: string | null;
  isGuest?: boolean;
  createdAt?: string;
  updatedAt?: string;
  userMetadata?: Record<string, any> | null;
}): User => {
  const meta = params.userMetadata || {};
  const firstName =
    (typeof meta.firstName === "string" && meta.firstName.trim()) ||
    (typeof meta.first_name === "string" && meta.first_name.trim()) ||
    "Guest";
  const lastName =
    (typeof meta.lastName === "string" && meta.lastName.trim()) ||
    (typeof meta.last_name === "string" && meta.last_name.trim()) ||
    "User";
  const email =
    params.email || `guest+${params.id}@anon.spokio.local`;

  const now = new Date().toISOString();
  return {
    _id: params.id,
    email,
    firstName,
    lastName,
    phone: undefined,
    emailVerified: false,
    subscriptionPlan: "free",
    createdAt: params.createdAt || now,
    updatedAt: params.updatedAt || now,
    isGuest: Boolean(params.isGuest),
  };
};

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const tokensRef = useRef<{ accessToken: string | null; refreshToken: string | null }>({
    accessToken: null,
    refreshToken: null,
  });

  const setUser = useCallback((updatedUser: User) => {
    setUserState(updatedUser);
    monitoringService.setUser(updatedUser);
  }, []);

  const clearSession = useCallback(async () => {
    tokensRef.current = { accessToken: null, refreshToken: null };
    setAccessToken(null);
    setRefreshToken(null);
    setUserState(null);
    monitoringService.trackEvent("auth_session_cleared");
    monitoringService.setUser(null);
    void firebaseAnalyticsService.setUserId(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await userApi.me();
      setUser(profile);
      return profile;
    } catch (error) {
      logger.warn("⚠️", "Failed to fetch /users/me", error);
      return null;
    }
  }, [setUser]);

  const applySupabaseSession = useCallback(
    async (session: any | null) => {
      if (!session) {
        await clearSession();
        return;
      }

      const authUser = session.user;
      const isGuest =
        typeof (authUser as any)?.is_anonymous === "boolean"
          ? Boolean((authUser as any).is_anonymous)
          : !authUser?.email;

      const nextTokens = {
        accessToken: session.access_token as string,
        refreshToken: (session.refresh_token as string) || null,
      };

      tokensRef.current = nextTokens;
      setAccessToken(nextTokens.accessToken);
      setRefreshToken(nextTokens.refreshToken);

      // Allow the app to transition to "authenticated" UI immediately.
      const placeholder = buildPlaceholderUser({
        id: authUser.id,
        email: authUser.email,
        isGuest,
        createdAt: authUser.created_at,
        updatedAt: authUser.updated_at,
        userMetadata: authUser.user_metadata,
      });
      setUserState(placeholder);

      // Observability.
      monitoringService.setUser(placeholder);
      void firebaseAnalyticsService.setUserId(placeholder._id);

      // Fetch canonical profile from backend (subscription plan, isGuest, etc).
      const profile = await refreshProfile();
      const effectiveUser = profile || placeholder;

      monitoringService.trackEvent("auth_session_established", {
        userId: effectiveUser._id,
        plan: effectiveUser.subscriptionPlan,
        mode: effectiveUser.isGuest ? "guest" : "standard",
      });

      void notificationService.syncPushTokenWithServer();
    },
    [clearSession, refreshProfile]
  );

  const refreshTokensFn = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        return null;
      }

      await applySupabaseSession(data.session);
      return {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      };
    } catch (error) {
      logger.warn("⚠️", "Supabase refreshSession failed", error);
      return null;
    }
  }, [applySupabaseSession]);

  useEffect(() => {
    attachAuthHandlers({
      getAccessToken: () => tokensRef.current.accessToken,
      getRefreshToken: () => tokensRef.current.refreshToken,
      refreshTokens: refreshTokensFn,
      onUnauthorized: () => {
        void supabase.auth.signOut();
      },
    });

    return () => attachAuthHandlers(null);
  }, [refreshTokensFn]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        await applySupabaseSession(data.session);
      } finally {
        if (mounted) setInitializing(false);
      }
    };

    init().catch((error) => {
      logger.warn("⚠️", "Failed to initialize Supabase session", error);
      setInitializing(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        await applySupabaseSession(session);
      }
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [applySupabaseSession]);

  const startGuestSession = useCallback(async () => {
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session?.user) {
      const isAnon =
        typeof (existing.session.user as any)?.is_anonymous === "boolean"
          ? Boolean((existing.session.user as any).is_anonymous)
          : !existing.session.user.email;
      if (isAnon) {
        return;
      }
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.session) {
      throw new Error(error?.message || "Unable to start guest session");
    }

    await applySupabaseSession(data.session);
  }, [applySupabaseSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        throw new Error(error.message);
      }
      if (data.session) {
        await applySupabaseSession(data.session);
      }
    },
    [applySupabaseSession]
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
      // If the user is currently a guest, upgrading preserves their user id + history.
      const { data: existing } = await supabase.auth.getSession();
      const isAnon =
        typeof (existing.session?.user as any)?.is_anonymous === "boolean"
          ? Boolean((existing.session?.user as any).is_anonymous)
          : !existing.session?.user?.email;

      if (existing.session?.user && isAnon) {
        const { error } = await supabase.auth.updateUser({
          email: payload.email,
          password: payload.password,
          data: {
            firstName: payload.firstName,
            lastName: payload.lastName,
            phone: payload.phone,
            referralCode: payload.referralCode,
          },
        });
        if (error) {
          throw new Error(error.message);
        }
        await refreshProfile();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: {
            firstName: payload.firstName,
            lastName: payload.lastName,
            phone: payload.phone,
            referralCode: payload.referralCode,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      // If email confirmation is enabled, session can be null here.
      if (data.session) {
        await applySupabaseSession(data.session);
      }
    },
    [applySupabaseSession, refreshProfile]
  );

  const upgradeGuest = useCallback(
    async (payload: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      referralCode?: string;
    }) => {
      const { data: existing } = await supabase.auth.getSession();
      const authUser = existing.session?.user;
      const isAnon =
        typeof (authUser as any)?.is_anonymous === "boolean"
          ? Boolean((authUser as any).is_anonymous)
          : !authUser?.email;

      if (!authUser || !isAnon) {
        throw new Error("Guest session required to upgrade");
      }

      const { error } = await supabase.auth.updateUser({
        email: payload.email,
        password: payload.password,
        data: {
          firstName: payload.firstName,
          lastName: payload.lastName,
          phone: payload.phone,
          referralCode: payload.referralCode,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      await refreshProfile();
    },
    [refreshProfile]
  );

  const continueWithGoogle = useCallback(async () => {
    const redirectTo = Linking.createURL("auth/callback");

    const { data: existing } = await supabase.auth.getSession();
    const isAnon =
      typeof (existing.session?.user as any)?.is_anonymous === "boolean"
        ? Boolean((existing.session?.user as any).is_anonymous)
        : !existing.session?.user?.email;

    const oauth =
      existing.session?.user && isAnon
        ? await supabase.auth.linkIdentity({
            provider: "google",
            options: { redirectTo, skipBrowserRedirect: true },
          } as any)
        : await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo, skipBrowserRedirect: true },
          } as any);

    if (oauth.error) {
      throw new Error(oauth.error.message);
    }

    const url = (oauth.data as any)?.url as string | undefined;
    if (!url) {
      throw new Error("Unable to start Google sign-in");
    }

    const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
    if (result.type !== "success" || !("url" in result) || !result.url) {
      throw new Error("Google sign-in cancelled");
    }

    const { error } = await supabase.auth.exchangeCodeForSession(result.url);
    if (error) {
      throw new Error(error.message);
    }

    await refreshProfile();
  }, [refreshProfile]);

  const requestPasswordReset = useCallback(async (email: string) => {
    const redirectTo = Linking.createURL("auth/reset");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const confirmPasswordReset = useCallback(async (_token: string, newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      void notificationService.unregisterPushTokenFromServer();
    } catch {}
    await supabase.auth.signOut();
    await clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      refreshToken,
      initializing,
      startGuestSession,
      login,
      register,
      upgradeGuest,
      continueWithGoogle,
      requestPasswordReset,
      confirmPasswordReset,
      logout,
      refreshProfile,
      setUser,
    }),
    [
      user,
      accessToken,
      refreshToken,
      initializing,
      startGuestSession,
      login,
      register,
      upgradeGuest,
      continueWithGoogle,
      requestPasswordReset,
      confirmPasswordReset,
      logout,
      refreshProfile,
      setUser,
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
