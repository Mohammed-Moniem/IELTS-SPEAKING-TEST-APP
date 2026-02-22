/**
 * Theme Context
 * Manages dark/light theme globally with AsyncStorage + backend persistence
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, useColorScheme } from "react-native";

import { userApi } from "../api/services";
import { darkColors } from "../theme/darkTokens";
import type { ColorTokens } from "../theme/tokens";
import { colors as lightColors } from "../theme/tokens";

const THEME_STORAGE_KEY = "app_theme";

export type ThemeMode = "light" | "dark" | "system";
export type ActiveTheme = "light" | "dark";
const THEME_MODE_ORDER: ThemeMode[] = ["system", "light", "dark"];

interface ThemeContextType {
  theme: ActiveTheme;
  themeMode: ThemeMode;
  colors: ColorTokens;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  cycleThemeMode: () => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemTheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [theme, setTheme] = useState<ActiveTheme>(
    systemTheme === "dark" ? "dark" : "light"
  );

  // Load theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Listen to system theme changes
  useEffect(() => {
    if (themeMode === "system") {
      setTheme(systemTheme === "dark" ? "dark" : "light");
    }
  }, [systemTheme, themeMode]);

  const loadThemePreference = async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (stored) {
        const mode = stored as ThemeMode;
        setThemeModeState(mode);

        if (mode === "system") {
          setTheme(systemTheme === "dark" ? "dark" : "light");
        } else {
          setTheme(mode);
        }
      }
    } catch (error) {
      console.error("Failed to load theme preference:", error);
    }
  };

  const setThemeMode = useCallback(
    async (mode: ThemeMode) => {
      try {
        setThemeModeState(mode);

        // Save to AsyncStorage
        await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);

        // Update active theme based on mode
        if (mode === "system") {
          setTheme(Appearance.getColorScheme() === "dark" ? "dark" : "light");
        } else {
          setTheme(mode);
        }

        // Sync to backend (non-blocking)
        userApi
          .updateProfile({ appTheme: mode })
          .catch((err) =>
            console.warn("Failed to sync theme to backend:", err)
          );
      } catch (error) {
        console.error("Failed to save theme preference:", error);
      }
    },
    [systemTheme]
  );

  const toggleTheme = useCallback(async () => {
    const newTheme: ActiveTheme = theme === "light" ? "dark" : "light";
    await setThemeMode(newTheme);
  }, [theme, setThemeMode]);

  const cycleThemeMode = useCallback(async () => {
    const currentIndex = THEME_MODE_ORDER.indexOf(themeMode);
    const nextIndex = (currentIndex + 1) % THEME_MODE_ORDER.length;
    await setThemeMode(THEME_MODE_ORDER[nextIndex]);
  }, [themeMode, setThemeMode]);

  const currentColors = useMemo(
    () => (theme === "dark" ? darkColors : lightColors),
    [theme]
  );

  const value = useMemo(
    () => ({
      theme,
      themeMode,
      colors: currentColors,
      setThemeMode,
      cycleThemeMode,
      toggleTheme,
    }),
    [theme, themeMode, currentColors, setThemeMode, cycleThemeMode, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
