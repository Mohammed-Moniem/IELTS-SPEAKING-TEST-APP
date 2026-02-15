import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { subscriptionApi, usageApi } from "../../api/services";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { StatCard } from "../../components/StatCard";
import { Tag } from "../../components/Tag";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { formatDate } from "../../utils/date";

export const UsageScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const usageQuery = useQuery({
    queryKey: ["usage-summary"],
    queryFn: usageApi.summary,
  });

  const subscriptionQuery = useQuery({
    queryKey: ["subscription-current"],
    queryFn: subscriptionApi.current,
  });

  const refreshing = usageQuery.isRefetching || subscriptionQuery.isRefetching;

  const handleRefresh = async () => {
    await Promise.all([usageQuery.refetch(), subscriptionQuery.refetch()]);
  };

  const planLabel =
    subscriptionQuery.data?.metadata?.label ||
    subscriptionQuery.data?.planType?.toUpperCase() ||
    "Free";

  const stripeEnabled = !!subscriptionQuery.data?.stripe?.enabled;

  return (
    <ScreenContainer>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Usage</Text>
          <Text style={styles.subtitle}>Monthly limits and reset dates</Text>
        </View>

        {(usageQuery.isLoading || subscriptionQuery.isLoading) && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading usage…</Text>
          </View>
        )}

        {subscriptionQuery.data ? (
          <Card>
            <SectionHeading title="Current plan" />
            <View style={styles.planRow}>
              <Tag
                label={planLabel}
                tone={
                  subscriptionQuery.data.planType === "free" ? "info" : "success"
                }
              />
              <Text style={styles.planStatus}>
                {stripeEnabled ? subscriptionQuery.data.status : "Billing disabled"}
              </Text>
            </View>
            <Text style={styles.planMeta}>
              {subscriptionQuery.data.isTrialActive
                ? `Trial ends ${formatDate(subscriptionQuery.data.trialEndsAt)}`
                : `Active since ${formatDate(subscriptionQuery.data.subscriptionDate)}`}
            </Text>
          </Card>
        ) : null}

        {usageQuery.data ? (
          <Card>
            <SectionHeading title="This month" />
            <View style={styles.statsRow}>
              <StatCard
                label="Practice sessions"
                value={`${usageQuery.data.practiceCount}/${
                  usageQuery.data.practiceLimit ?? "∞"
                }`}
                hint="Used this month"
              />
              <StatCard
                label="Mock tests"
                value={`${usageQuery.data.testCount}/${
                  usageQuery.data.testLimit ?? "∞"
                }`}
                hint="Used this month"
              />
            </View>
            <Text style={styles.resetHint}>
              Resets every month • Last reset {formatDate(usageQuery.data.lastReset)}
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: spacing.xxl,
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    fontWeight: "600",
  },
  planRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  planStatus: {
    color: colors.textSecondary,
    fontWeight: "600",
  },
  planMeta: {
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  resetHint: {
    marginTop: spacing.sm,
    color: colors.textMuted,
  },
  });
