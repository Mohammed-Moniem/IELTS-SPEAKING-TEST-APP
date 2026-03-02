import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  CompositeNavigationProp,
  useNavigation,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
import { getProgressStats } from "../../api/analyticsApi";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { StatCard } from "../../components/StatCard";
import { Tag } from "../../components/Tag";
import { ThemeModeSwitch } from "../../components/ThemeModeSwitch";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import {
  AppRootStackParamList,
  AppTabParamList,
} from "../../navigation/AppNavigator";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { formatDate } from "../../utils/date";

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<
    CompositeNavigationProp<
      BottomTabNavigationProp<AppTabParamList>,
      NativeStackNavigationProp<AppRootStackParamList>
    >
  >();
  const { user, refreshProfile } = useAuth();
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

  const progressQuery = useQuery({
    queryKey: ["home-progress-trend", user?._id],
    queryFn: () =>
      getProgressStats(user!._id, {
        daysBack: 30,
        includeTests: 20,
      }),
    enabled: Boolean(user?._id),
  });

  const refreshing = usageQuery.isRefetching || subscriptionQuery.isRefetching;

  const handleRefresh = async () => {
    await Promise.all([
      usageQuery.refetch(),
      subscriptionQuery.refetch(),
      progressQuery.refetch(),
      refreshProfile(),
    ]);
  };

  const nextBestAction =
    progressQuery.data?.weaknesses?.[0] ??
    "Run one focused speaking practice session today.";

  return (
    <ScreenContainer>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <Text style={styles.greeting}>
              Hi {user?.firstName || "there"} 👋
            </Text>
            <ThemeModeSwitch />
          </View>
          <Text style={styles.subtitle}>
            Ready for your next speaking session?
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Button
            title="Start practice"
            onPress={() => navigation.navigate("Practice")}
            style={styles.actionButton}
            accessibilityLabel="Start practice"
            accessibilityHint="Open topic practice and begin a speaking session"
          />
          <Button
            title="Run simulation"
            onPress={() => navigation.navigate("Simulations")}
            style={styles.actionButton}
            variant="secondary"
            accessibilityLabel="Run simulation"
            accessibilityHint="Open exam-style simulation tests"
          />
        </View>

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
                onPress={() => navigation.navigate("Profile")}
                variant="ghost"
                accessibilityLabel={
                  subscriptionQuery.data.planType === "free"
                    ? "Upgrade plan"
                    : "Manage subscription"
                }
                accessibilityHint="Open your profile billing and subscription options"
              />
            ) : null}
          </Card>
        ) : null}

        {progressQuery.data ? (
          <Card>
            <SectionHeading title="Your momentum" />
            <View style={styles.trendRow}>
              <View style={styles.trendMetric}>
                <Text style={styles.trendValue}>
                  {progressQuery.data.averageBand.toFixed(1)}
                </Text>
                <Text style={styles.trendLabel}>30-day average band</Text>
              </View>
              <View style={styles.trendMetric}>
                <Text style={styles.trendValue}>
                  {progressQuery.data.highestBand.toFixed(1)}
                </Text>
                <Text style={styles.trendLabel}>Highest band</Text>
              </View>
            </View>
            <Text style={styles.trendSummary}>
              Trend: {progressQuery.data.bandTrend}
            </Text>
            <View style={styles.nextBestActionCard}>
              <Text style={styles.nextBestActionTitle}>Next best action</Text>
              <Text style={styles.nextBestActionText}>{nextBestAction}</Text>
            </View>
            <Button
              title="See full analytics"
              variant="ghost"
              onPress={() => navigation.navigate("Analytics")}
              accessibilityLabel="See full analytics"
              accessibilityHint="Open detailed performance analytics"
            />
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
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    greeting: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.textPrimary,
      flex: 1,
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
    trendRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    trendMetric: {
      flex: 1,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
      padding: spacing.sm,
    },
    trendValue: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
    },
    trendLabel: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: spacing.xxs,
    },
    trendSummary: {
      color: colors.textSecondary,
      fontSize: 14,
      marginBottom: spacing.sm,
      textTransform: "capitalize",
    },
    nextBestActionCard: {
      backgroundColor: colors.statusInfoBackground,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.statusInfoBorder,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    nextBestActionTitle: {
      color: colors.statusInfoText,
      fontWeight: "700",
      fontSize: 13,
      marginBottom: spacing.xxs,
    },
    nextBestActionText: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
  });
