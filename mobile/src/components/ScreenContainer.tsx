import React, { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useThemedStyles } from "../hooks";
import type { ColorTokens } from "../theme/tokens";
import { spacing } from "../theme/tokens";

interface ScreenContainerProps {
  scrollable?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  bounces?: boolean;
}

export const ScreenContainer: React.FC<
  PropsWithChildren<ScreenContainerProps>
> = ({
  children,
  scrollable,
  style,
  contentContainerStyle,
  bounces = true,
}) => {
  const styles = useThemedStyles(createStyles);

  if (scrollable) {
    return (
      <SafeAreaView style={[styles.safeArea, style]}>
        <ScrollView
          contentContainerStyle={[styles.content, contentContainerStyle]}
          bounces={bounces}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, style]}>
      <View style={[styles.content, contentContainerStyle]}>{children}</View>
    </SafeAreaView>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.backgroundMuted,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
  });
