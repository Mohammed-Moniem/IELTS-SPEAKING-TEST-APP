import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "../../components/ScreenContainer";
import { colors } from "../../theme/tokens";

export const UsageScreen: React.FC = () => {
  return (
    <ScreenContainer>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Usage</Text>
          <Text style={styles.subtitle}>Track your app usage</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coming Soon</Text>
          <Text style={styles.sectionText}>
            Usage tracking page is under development. Here you'll be able to see
            your API usage, limits, and statistics.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
