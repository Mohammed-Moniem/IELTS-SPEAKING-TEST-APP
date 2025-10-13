import * as SecureStore from "expo-secure-store";

import { AuthResponse } from "../types/api";

const STORAGE_KEY = "ielts-speaking-auth";

type StoredAuth = Pick<AuthResponse, "accessToken" | "refreshToken">;

export const persistAuth = async (tokens: StoredAuth) => {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(tokens));
};

export const loadAuth = async (): Promise<StoredAuth | null> => {
  try {
    const value = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.accessToken &&
      parsed.refreshToken
    ) {
      return parsed;
    }
    return null;
  } catch (error) {
    console.warn("Failed to parse auth storage", error);
    return null;
  }
};

export const clearAuth = async () => {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
};
