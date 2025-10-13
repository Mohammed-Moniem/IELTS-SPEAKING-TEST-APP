import React, { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

interface SectionHeadingProps {
  title: string;
  action?: React.ReactNode;
}

export const SectionHeading: React.FC<
  PropsWithChildren<SectionHeadingProps>
> = ({ title, action, children }) => (
  <View style={styles.container}>
    <View>
      <Text style={styles.title}>{title}</Text>
      {children ? <Text style={styles.subtitle}>{children}</Text> : null}
    </View>
    {action}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
