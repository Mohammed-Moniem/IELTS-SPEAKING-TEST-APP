import React, { PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { useThemedStyles } from "../hooks";
import type { ColorTokens } from "../theme/tokens";
import { radii, shadows, spacing } from "../theme/tokens";

interface CardProps {
  style?: ViewStyle;
}

export const Card: React.FC<PropsWithChildren<CardProps>> = ({
  children,
  style,
}) => {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.card, style]}>{children}</View>;
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.xxl,
      padding: spacing.md,
      ...shadows.card,
      marginVertical: 8,
    },
  });
