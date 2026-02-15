import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import type { ColorTokens } from "../theme/tokens";
import { spacing } from "../theme/tokens";

interface EmptyStateProps {
  title: string;
  description?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      paddingVertical: spacing.xxl + spacing.md,
      paddingHorizontal: spacing.md,
      alignItems: "center",
    },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  description: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
  });
