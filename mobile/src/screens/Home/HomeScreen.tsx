import { useNavigation } from "@react-navigation/native";
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

import { analyticsApi, profileApi, subscriptionApi, usageApi } from "../../api/services";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/Button";
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

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const userId = user?._id;

  const usageQuery = useQuery({
    queryKey: ["usage-summary"],
    queryFn: usageApi.summary,
  });

  const subscriptionQuery = useQuery({
    queryKey: ["subscription-current"],
    queryFn: subscriptionApi.current,
  });

  const profileStatsQuery = useQuery({
    queryKey: ["profile-stats", userId],
    queryFn: () => profileApi.stats(userId as string),
    enabled: Boolean(userId),
  });

  const progressQuery = useQuery({
    queryKey: ["analytics-progress", userId],
    queryFn: () => analyticsApi.progress(userId as string, { daysBack: 30, includeTests: 3 }),
    enabled: Boolean(userId),
  });

  const refreshing =
    usageQuery.isRefetching ||
    subscriptionQuery.isRefetching ||
    profileStatsQuery.isRefetching ||
    progressQuery.isRefetching;

  const handleRefresh = async () => {
    await Promise.all([
      usageQuery.refetch(),
      subscriptionQuery.refetch(),
      profileStatsQuery.refetch(),
      progressQuery.refetch(),
      refreshProfile(),
    ]);
  };

  const trendLabel = (trend?: string): { label: string; tone: "info" | "success" | "warning" } => {
    if (trend === "improving") return { label: "Improving", tone: "success" };
    if (trend === "declining") return { label: "Declining", tone: "warning" };
    if (trend === "stable") return { label: "Stable", tone: "info" };
    return { label: "New", tone: "info" };
  };

  return (
    <ScreenContainer>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.hero}>
          <Text style={styles.greeting}>
            Hi {user?.firstName || "there"} 👋
          </Text>
          <Text style={styles.subtitle}>
            Ready for your next speaking session?
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Button
            title="Start practice"
            onPress={() => navigation.navigate("Practice")}
            style={styles.actionButton}
          />
          <Button
            title="Run simulation"
            onPress={() =>
              navigation.getParent?.()?.navigate?.("Simulations") ??
              navigation.navigate("Simulations")
            }
            style={styles.actionButton}
            variant="secondary"
          />
        </View>

        <Card>
          <SectionHeading title="Progress snapshot" />
          {profileStatsQuery.isLoading || progressQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <View style={styles.statsRow}>
                <StatCard
                  label="Streak"
                  value={`${profileStatsQuery.data?.statistics?.currentStreak ?? 0}`}
                  hint="Days"
                />
                <StatCard
                  label="Avg band"
                  value={`${progressQuery.data?.averageBand ?? 0}`}
                  hint="Last 30 days"
                />
              </View>

              <View style={styles.snapshotRow}>
                <Tag
                  label={trendLabel(progressQuery.data?.bandTrend).label}
                  tone={trendLabel(progressQuery.data?.bandTrend).tone}
                />
                <Text style={styles.snapshotMeta}>
                  {progressQuery.data?.totalTests
                    ? `${progressQuery.data.totalTests} tests tracked`
                    : "Complete a session to start tracking"}
                </Text>
              </View>

              {Array.isArray(progressQuery.data?.weaknesses) &&
              progressQuery.data.weaknesses.length > 0 ? (
                <View style={styles.weaknessList}>
                  <Text style={styles.weaknessTitle}>Focus next on</Text>
                  {progressQuery.data.weaknesses.slice(0, 2).map((w: string) => (
                    <Text key={w} style={styles.weaknessItem}>
                      • {w}
                    </Text>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </Card>

        {usageQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : usageQuery.data ? (
          <Card>
            <SectionHeading title="Your monthly usage" />
            <View style={styles.statsRow}>
              <StatCard
                label="Practice sessions"
                value={`${usageQuery.data.practiceCount}/${
                  usageQuery.data.practiceLimit ?? "∞"
                }`}
                hint="Used this month"
              />
              <StatCard
                label="Test simulations"
                value={`${usageQuery.data.testCount}/${
                  usageQuery.data.testLimit ?? "∞"
                }`}
                hint="Used this month"
              />
            </View>
            <Text style={styles.resetHint}>
              Resets every month • Last reset{" "}
              {formatDate(usageQuery.data.lastReset)}
            </Text>
          </Card>
        ) : null}

        {subscriptionQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : subscriptionQuery.data ? (
          <Card>
            <SectionHeading title="Subscription" />
            <View style={styles.subscriptionHeader}>
              <Tag
                label={subscriptionQuery.data.planType.toUpperCase()}
                tone={
                  subscriptionQuery.data.planType === "free"
                    ? "info"
                    : "success"
                }
              />
              <Text style={styles.subscriptionStatus}>
                {subscriptionQuery.data.status}
              </Text>
            </View>
            <Text style={styles.subscriptionMeta}>
              {subscriptionQuery.data.metadata?.label} plan •{" "}
              {subscriptionQuery.data.isTrialActive
                ? `Trial ends ${formatDate(subscriptionQuery.data.trialEndsAt)}`
                : `Active since ${formatDate(
                    subscriptionQuery.data.subscriptionDate
                  )}`}
            </Text>
            <View style={styles.featureList}>
              {subscriptionQuery.data.metadata?.features?.map((feature) => (
                <Text key={feature} style={styles.featureItem}>
                  • {feature}
                </Text>
              ))}
            </View>
            {subscriptionQuery.data?.stripe?.enabled ? (
              <Button
                title={
                  subscriptionQuery.data.planType === "free"
                    ? "Upgrade plan"
                    : "Manage subscription"
                }
                onPress={() =>
                  navigation.getParent?.()?.navigate?.("Profile") ??
                  navigation.navigate("Profile")
                }
                variant="ghost"
              />
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    content: {
      paddingBottom: spacing.xxl + spacing.sm,
  },
  hero: {
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 16,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  snapshotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  snapshotMeta: {
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 12,
  },
  weaknessList: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  weaknessTitle: {
    color: colors.textSecondary,
    fontWeight: "800",
  },
  weaknessItem: {
    color: colors.textMuted,
  },
  resetHint: {
    marginTop: spacing.sm,
    color: colors.textMuted,
  },
  subscriptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  subscriptionStatus: {
    color: colors.textSecondary,
    fontWeight: "600",
  },
  subscriptionMeta: {
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  featureList: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  featureItem: {
    color: colors.textSecondary,
  },
  });
