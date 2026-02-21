import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { useTheme } from "../context";
import type { ColorTokens } from "../theme/tokens";

type NamedStyles<T> = StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>;

/**
 * Helper hook to generate StyleSheet objects that respond to theme changes.
 * Pass it a stable factory (defined outside components) and it will rebuild
 * styles whenever the active color palette changes.
 */
export const useThemedStyles = <T extends NamedStyles<T>>(
  stylesFactory: (colors: ColorTokens) => T
): T => {
  const { colors } = useTheme();
  return useMemo(() => stylesFactory(colors), [colors, stylesFactory]);
};
