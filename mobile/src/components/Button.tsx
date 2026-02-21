import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";

import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import type { ColorTokens } from "../theme/tokens";
import { radii, spacing } from "../theme/tokens";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        style,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "ghost" ? colors.textPrimary : colors.primaryOn}
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "ghost" ? styles.ghostLabel : undefined,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    base: {
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      borderRadius: radii.xxl,
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 6,
    },
    primary: {
      backgroundColor: colors.primary,
    },
    secondary: {
      backgroundColor: colors.secondary,
    },
    ghost: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.border,
    },
    label: {
      color: colors.primaryOn,
      fontSize: 16,
      fontWeight: "600",
    },
    ghostLabel: {
      color: colors.textPrimary,
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.5,
    },
  });
