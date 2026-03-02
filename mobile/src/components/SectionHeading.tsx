import React, { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useThemedStyles } from "../hooks";
import type { ColorTokens } from "../theme/tokens";
import { spacing } from "../theme/tokens";

interface SectionHeadingProps {
  title: string;
  action?: React.ReactNode;
}

export const SectionHeading: React.FC<
  PropsWithChildren<SectionHeadingProps>
> = ({ title, action, children }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <View>
        <Text
          accessibilityRole="header"
          allowFontScaling
          maxFontSizeMultiplier={1.35}
          style={styles.title}
        >
          {title}
        </Text>
        {children ? (
          <Text allowFontScaling maxFontSizeMultiplier={1.35} style={styles.subtitle}>
            {children}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
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
