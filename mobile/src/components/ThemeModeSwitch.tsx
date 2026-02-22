import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { ThemeMode, useTheme } from "../context";
import { spacing } from "../theme/tokens";

interface ThemeModeSwitchProps {
  style?: StyleProp<ViewStyle>;
}

const MODE_LABEL: Record<ThemeMode, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const MODE_ICON: Record<ThemeMode, keyof typeof Ionicons.glyphMap> = {
  system: "phone-portrait-outline",
  light: "sunny-outline",
  dark: "moon-outline",
};

const MODE_ORDER: ThemeMode[] = ["system", "light", "dark"];

const getNextMode = (mode: ThemeMode): ThemeMode => {
  const index = MODE_ORDER.indexOf(mode);
  return MODE_ORDER[(index + 1) % MODE_ORDER.length];
};

export const ThemeModeSwitch: React.FC<ThemeModeSwitchProps> = ({ style }) => {
  const { colors, themeMode, cycleThemeMode } = useTheme();
  const nextMode = getNextMode(themeMode);

  return (
    <Pressable
      onPress={cycleThemeMode}
      accessibilityRole="button"
      accessibilityLabel={`Theme mode: ${MODE_LABEL[themeMode]}`}
      accessibilityHint={`Switch to ${MODE_LABEL[nextMode]} mode`}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={MODE_ICON[themeMode]} size={16} color={colors.primary} />
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {MODE_LABEL[themeMode]}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});
