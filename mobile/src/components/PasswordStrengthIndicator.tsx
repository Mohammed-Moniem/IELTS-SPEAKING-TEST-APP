import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import type { ColorTokens } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { calculatePasswordStrength } from "../utils/validationHelpers";

interface PasswordStrengthIndicatorProps {
  password: string;
  showSuggestions?: boolean;
}

/**
 * PasswordStrengthIndicator component
 * Displays visual feedback for password strength with color-coded bar and suggestions
 */
export const PasswordStrengthIndicator: React.FC<
  PasswordStrengthIndicatorProps
> = ({ password, showSuggestions = true }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { strength, suggestions } = useMemo(
    () => calculatePasswordStrength(password),
    [password]
  );

  // Don't show anything if password is empty
  if (!password || password.length === 0) {
    return null;
  }

  const getStrengthColor = () => {
    switch (strength) {
      case "weak":
        return colors.danger;
      case "fair":
        return colors.warning;
      case "good":
        return colors.success;
      case "strong":
        return colors.primary;
      default:
        return colors.textMuted;
    }
  };

  const getStrengthWidth = () => {
    switch (strength) {
      case "weak":
        return "25%";
      case "fair":
        return "50%";
      case "good":
        return "75%";
      case "strong":
        return "100%";
      default:
        return "0%";
    }
  };

  const getStrengthText = () => {
    switch (strength) {
      case "weak":
        return "Weak";
      case "fair":
        return "Fair";
      case "good":
        return "Good";
      case "strong":
        return "Strong";
      default:
        return "";
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Password strength:</Text>
        <Text style={[styles.strengthText, { color: getStrengthColor() }]}>
          {getStrengthText()}
        </Text>
      </View>

      {/* Strength bar */}
      <View style={styles.barContainer}>
        <View
          style={[
            styles.barFill,
            {
              width: getStrengthWidth(),
              backgroundColor: getStrengthColor(),
            },
          ]}
        />
      </View>

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Suggestions:</Text>
          {suggestions.map((suggestion, index) => (
            <Text key={index} style={styles.suggestionItem}>
              • {suggestion}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "600",
  },
  barContainer: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
  },
  suggestionsContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  suggestionItem: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  });
