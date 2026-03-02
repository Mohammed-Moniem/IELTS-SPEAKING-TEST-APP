import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { subscriptionApi, usageApi } from "../../api/services";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";

const normalizeProgress = (used: number, limit: number | null) => {
  if (limit == null || limit <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (used / limit) * 100));
};

const usageDescriptor = (used: number, limit: number | null) => {
  if (limit == null) {
    return `${used} used • Unlimited`;
  }
  if (used >= limit) {
    return `${used}/${limit} used • Limit reached`;
  }
  return `${used}/${limit} used • ${limit - used} remaining`;
};

const formatDate = (value?: string) => {
  if (!value) {
    return "Not available";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const UsageScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<any>();

  const usageQuery = useQuery({
    queryKey: ["usage-summary"],
    queryFn: usageApi.summary,
  });
  const subscriptionQuery = useQuery({
    queryKey: ["subscription-current"],
    queryFn: subscriptionApi.current,
  });

  const errorMessage =
    (usageQuery.error as any)?.message ||
    (subscriptionQuery.error as any)?.message ||
    null;

  if (usageQuery.isLoading || subscriptionQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerStateText}>Loading usage summary...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (errorMessage || !usageQuery.data || !subscriptionQuery.data) {
    return (
      <ScreenContainer>
        <View style={styles.centerState}>
          <Ionicons name="warning-outline" size={42} color={colors.warning} />
          <Text style={styles.centerStateTitle}>Usage data unavailable</Text>
          <Text style={styles.centerStateText}>
            {errorMessage ||
              "We could not load your current limits. Pull to retry or try again shortly."}
          </Text>
          <Button
            title="Retry"
            onPress={() => {
              void usageQuery.refetch();
              void subscriptionQuery.refetch();
            }}
          />
        </View>
      </ScreenContainer>
    );
  }

  const usage = usageQuery.data;
  const subscription = subscriptionQuery.data;
  const planLabel = subscription.metadata?.label || subscription.planType;
  const practiceProgress = normalizeProgress(usage.practiceCount, usage.practiceLimit);
  const testProgress = normalizeProgress(usage.testCount, usage.testLimit);

  return (
    <ScreenContainer scrollable>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeading title="Usage">
          Understand your current limits and when they reset.
        </SectionHeading>

        <Card>
          <View style={styles.planRow}>
            <View>
              <Text style={styles.planLabel}>Current plan</Text>
              <Text style={styles.planValue}>{planLabel}</Text>
            </View>
            <TouchableOpacity
              style={[styles.planAction, { borderColor: colors.divider }]}
              onPress={() => navigation.navigate("Subscription")}
            >
              <Ionicons name="settings-outline" size={16} color={colors.primary} />
              <Text style={styles.planActionText}>Manage</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.metaText}>Cycle reset: {formatDate(usage.lastReset)}</Text>
        </Card>

        <SectionHeading title="Session Limits">
          Limits are checked before you start a session to avoid surprise failures.
        </SectionHeading>
        <Card>
          <View style={styles.metricBlock}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricTitle}>Practice sessions</Text>
              <Text style={styles.metricValue}>
                {usage.practiceLimit == null ? "Unlimited" : usage.practiceLimit}
              </Text>
            </View>
            <Text style={styles.metricDescription}>
              {usageDescriptor(usage.practiceCount, usage.practiceLimit)}
            </Text>
            {usage.practiceLimit != null ? (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${practiceProgress}%`,
                      backgroundColor:
                        practiceProgress >= 100 ? colors.warning : colors.primary,
                    },
                  ]}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.metricBlock}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricTitle}>Full tests</Text>
              <Text style={styles.metricValue}>
                {usage.testLimit == null ? "Unlimited" : usage.testLimit}
              </Text>
            </View>
            <Text style={styles.metricDescription}>
              {usageDescriptor(usage.testCount, usage.testLimit)}
            </Text>
            {usage.testLimit != null ? (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${testProgress}%`,
                      backgroundColor:
                        testProgress >= 100 ? colors.warning : colors.primary,
                    },
                  ]}
                />
              </View>
            ) : null}
          </View>
        </Card>

        <SectionHeading title="What Happens at Limit">
          You can still review your results and history. Starting new sessions requires
          plan upgrade or cycle reset.
        </SectionHeading>
        <Card>
          <View style={styles.infoRow}>
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color={colors.success}
            />
            <Text style={styles.infoText}>Completed results remain accessible.</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons
              name="hourglass-outline"
              size={18}
              color={colors.info}
            />
            <Text style={styles.infoText}>
              New practice or full-test starts are blocked at the limit.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="gift-outline" size={18} color={colors.primary} />
            <Text style={styles.infoText}>
              Use points discounts before upgrading to reduce cost.
            </Text>
          </View>
          <View style={styles.actions}>
            <Button
              title="View plan options"
              onPress={() => navigation.navigate("Subscription")}
            />
            <TouchableOpacity
              style={[styles.secondaryAction, { borderColor: colors.divider }]}
              onPress={() => navigation.navigate("RedeemDiscount")}
            >
              <Text style={styles.secondaryActionText}>Redeem discount coupons</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xxl,
    },
    centerState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
    },
    centerStateTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
    },
    centerStateText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: spacing.sm,
    },
    planRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    planLabel: {
      fontSize: 13,
      color: colors.textMuted,
    },
    planValue: {
      fontSize: 20,
      color: colors.textPrimary,
      fontWeight: "700",
      textTransform: "capitalize",
    },
    planAction: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    planActionText: {
      color: colors.textPrimary,
      fontWeight: "600",
    },
    metricBlock: {
      marginBottom: spacing.md,
    },
    metricHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    metricTitle: {
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    metricValue: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "700",
    },
    metricDescription: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: spacing.xs,
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      overflow: "hidden",
      backgroundColor: colors.surfaceSubtle,
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    infoText: {
      flex: 1,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    actions: {
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    secondaryAction: {
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    secondaryActionText: {
      color: colors.textPrimary,
      fontWeight: "600",
    },
    metaText: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: spacing.xs,
    },
  });
