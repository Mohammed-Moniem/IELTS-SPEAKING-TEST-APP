import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "../theme/tokens";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, hint }) => (
  <View style={styles.card}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
    {hint ? <Text style={styles.hint}>{hint}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.xxl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  label: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primaryStrong,
  },
  hint: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
});
