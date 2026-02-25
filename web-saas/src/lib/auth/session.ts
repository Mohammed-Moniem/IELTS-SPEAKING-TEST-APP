import { AuthUser } from '@/lib/types';

const STORAGE_KEY = 'spokio.web.session.v1';

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export const loadStoredSession = (): StoredSession | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
};

export const saveStoredSession = (session: StoredSession) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const updateStoredTokens = (accessToken: string, refreshToken: string) => {
  const session = loadStoredSession();
  if (!session) return;

  saveStoredSession({
    ...session,
    accessToken,
    refreshToken
  });
};

export const clearStoredSession = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
};

export const getStoredAccessToken = () => loadStoredSession()?.accessToken || null;
export const getStoredRefreshToken = () => loadStoredSession()?.refreshToken || null;
