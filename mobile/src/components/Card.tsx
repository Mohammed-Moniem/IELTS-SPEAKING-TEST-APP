import React, { PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { colors, radii, shadows, spacing } from "../theme/tokens";

interface CardProps {
  style?: ViewStyle;
}

export const Card: React.FC<PropsWithChildren<CardProps>> = ({
  children,
  style,
}) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.md,
    ...shadows.card,
    marginVertical: 8,
  },
});
