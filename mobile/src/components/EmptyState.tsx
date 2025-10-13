import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

interface EmptyStateProps {
  title: string;
  description?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
}) => (
  <View style={styles.container}>
    <Text style={styles.title}>{title}</Text>
    {description ? <Text style={styles.description}>{description}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
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
