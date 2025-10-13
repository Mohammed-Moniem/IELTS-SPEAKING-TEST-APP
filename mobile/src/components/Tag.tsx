import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "../theme/tokens";

interface TagProps {
  label: string;
  tone?: "default" | "success" | "warning" | "info";
}

const toneStyles = {
  default: { background: colors.borderMuted, text: colors.textPrimary },
  success: { background: colors.successSoft, text: colors.successOn },
  warning: { background: colors.warningSoft, text: colors.warningOn },
  info: { background: colors.infoSoft, text: colors.info },
} as const;

export const Tag: React.FC<TagProps> = ({ label, tone = "default" }) => {
  const palette = toneStyles[tone];
  return (
    <View style={[styles.tag, { backgroundColor: palette.background }]}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  tag: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 2,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
});
