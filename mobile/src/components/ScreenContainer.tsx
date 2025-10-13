import React, { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../theme/tokens";

interface ScreenContainerProps {
  scrollable?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

export const ScreenContainer: React.FC<
  PropsWithChildren<ScreenContainerProps>
> = ({ children, scrollable, style, contentContainerStyle }) => {
  if (scrollable) {
    return (
      <SafeAreaView style={[styles.safeArea, style]}>
        <ScrollView
          contentContainerStyle={[styles.content, contentContainerStyle]}
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

const styles = StyleSheet.create({
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
