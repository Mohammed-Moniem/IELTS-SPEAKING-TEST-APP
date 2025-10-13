import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "../../components/ScreenContainer";
import { colors } from "../../theme/tokens";

export const SubscriptionScreen: React.FC = () => {
  return (
    <ScreenContainer>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Subscription</Text>
          <Text style={styles.subtitle}>Manage your subscription</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coming Soon</Text>
          <Text style={styles.sectionText}>
            Subscription management page is under development. Here you'll be
            able to view and manage your subscription plan.
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
