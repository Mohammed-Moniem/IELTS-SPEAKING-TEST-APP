/**
 * PointsPill Component
 * Displays user's points balance and tier in a compact pill format
 * Usage: Add to headers, profile screens, or navigation
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "../context";
import { usePoints, useThemedStyles } from "../hooks";
import type { ColorTokens } from "../theme/tokens";
import { spacing } from "../theme/tokens";

interface PointsPillProps {
  onPress?: () => void;
  showTier?: boolean;
  compact?: boolean;
}

export const PointsPill: React.FC<PointsPillProps> = ({
  onPress,
  showTier = true,
  compact = false,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { balance, currentTierName, loading } = usePoints();

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const content = (
    <View style={[styles.container, compact && styles.compactContainer]}>
      {/* Star Icon */}
      <Ionicons name="star" size={compact ? 14 : 16} color={colors.warning} />

      {/* Points Balance */}
      <Text style={[styles.points, compact && styles.compactPoints]}>
        {balance.toLocaleString()}
      </Text>

      {/* Tier Badge (if not compact) */}
      {showTier && !compact && currentTierName !== "None" && (
        <>
          <View style={styles.separator} />
          <Text style={styles.tier}>{currentTierName}</Text>
        </>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  compactContainer: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    gap: 4,
  },
  loadingContainer: {
    paddingHorizontal: spacing.lg,
  },
  points: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  compactPoints: {
    fontSize: 12,
    fontWeight: "500",
  },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: colors.border,
  },
  tier: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textSecondary,
    textTransform: "capitalize",
  },
  });
