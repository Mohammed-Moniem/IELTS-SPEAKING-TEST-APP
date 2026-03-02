import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import type { ColorTokens } from "../theme/tokens";
import { radii, spacing } from "../theme/tokens";

interface TagProps {
  label: string;
  tone?: "default" | "success" | "warning" | "info" | "premium";
}

type ToneStyle = {
  background: string;
  text: string;
  border?: string;
};

type TagTone = NonNullable<TagProps["tone"]>;

const getToneStyles = (colors: ColorTokens): Record<TagTone, ToneStyle> => ({
  default: { background: colors.borderMuted, text: colors.textPrimary },
  success: { background: colors.successSoft, text: colors.successOn },
  warning: { background: colors.warningSoft, text: colors.warningOn },
  info: { background: colors.infoSoft, text: colors.info },
  premium: {
    background: colors.badgePremiumBackground,
    text: colors.badgePremiumText,
    border: colors.badgePremiumBorder,
  },
});

export const Tag: React.FC<TagProps> = ({ label, tone = "default" }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const palette = getToneStyles(colors)[tone];
  return (
    <View
      style={[
        styles.tag,
        {
          backgroundColor: palette.background,
          borderColor: palette.border ?? `${colors.border}55`,
        },
      ]}
    >
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    tag: {
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs - 2,
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: `${colors.border}55`,
    },
    label: {
      fontSize: 12,
      fontWeight: "700",
    },
  });
