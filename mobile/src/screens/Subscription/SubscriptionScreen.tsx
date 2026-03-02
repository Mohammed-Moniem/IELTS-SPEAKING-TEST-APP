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

const formatResetDate = (value?: string) => {
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

export const SubscriptionScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<any>();

  const subscriptionQuery = useQuery({
    queryKey: ["subscription-current"],
    queryFn: subscriptionApi.current,
  });
  const usageQuery = useQuery({
    queryKey: ["usage-summary"],
    queryFn: usageApi.summary,
  });
  const configQuery = useQuery({
    queryKey: ["subscription-config"],
    queryFn: subscriptionApi.config,
  });

  const isLoading =
    subscriptionQuery.isLoading || usageQuery.isLoading || configQuery.isLoading;

  const errorMessage =
    (subscriptionQuery.error as any)?.message ||
    (usageQuery.error as any)?.message ||
    (configQuery.error as any)?.message;

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerStateText}>Loading your plan details...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (errorMessage) {
    return (
      <ScreenContainer>
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={42} color={colors.danger} />
          <Text style={styles.centerStateTitle}>Unable to load subscription</Text>
          <Text style={styles.centerStateText}>{errorMessage}</Text>
          <Button
            title="Retry"
            onPress={() => {
              void subscriptionQuery.refetch();
              void usageQuery.refetch();
              void configQuery.refetch();
            }}
          />
        </View>
      </ScreenContainer>
    );
  }

  if (!subscriptionQuery.data || !usageQuery.data) {
    return (
      <ScreenContainer>
        <View style={styles.centerState}>
          <Ionicons name="warning-outline" size={42} color={colors.warning} />
          <Text style={styles.centerStateTitle}>Subscription unavailable</Text>
          <Text style={styles.centerStateText}>
            We could not load your current plan details. Please retry in a moment.
          </Text>
          <Button
            title="Retry"
            onPress={() => {
              void subscriptionQuery.refetch();
              void usageQuery.refetch();
              void configQuery.refetch();
            }}
          />
        </View>
      </ScreenContainer>
    );
  }

  const subscription = subscriptionQuery.data;
  const usage = usageQuery.data;
  const plans = configQuery.data?.plans ?? [];
  const currentPlanDetails = plans.find((plan) => plan.tier === subscription.planType);
  const metadataFeatures = subscription.metadata?.features ?? [];
  const features = metadataFeatures.length
    ? metadataFeatures
    : currentPlanDetails?.features ?? [];
  const planLabel =
    subscription.metadata?.label || currentPlanDetails?.name || subscription.planType;
  const currency = currentPlanDetails?.currency || "usd";
  const monthlyPrice =
    currentPlanDetails && Number.isFinite(currentPlanDetails.price)
      ? currentPlanDetails.price
      : null;

  return (
    <ScreenContainer scrollable>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeading title="Subscription">
          See your current plan, limits, and upgrade path.
        </SectionHeading>

        <Card>
          <View style={styles.planHeader}>
            <View style={styles.planBadge}>
              <Ionicons name="diamond-outline" size={18} color={colors.primary} />
              <Text style={styles.planBadgeText}>{planLabel}</Text>
            </View>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    subscription.status === "active"
                      ? colors.successSoft
                      : colors.warningSoft,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  {
                    color:
                      subscription.status === "active"
                        ? colors.success
                        : colors.warning,
                  },
                ]}
              >
                {subscription.status}
              </Text>
            </View>
          </View>

          {monthlyPrice != null ? (
            <Text style={styles.priceText}>
              {monthlyPrice.toLocaleString("en-US", {
                style: "currency",
                currency: currency.toUpperCase(),
              })}
              /month
            </Text>
          ) : null}

          {subscription.isTrialActive ? (
            <View style={styles.infoRow}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={colors.info}
              />
              <Text style={styles.infoText}>
                Trial active until {formatResetDate(subscription.trialEndsAt)}.
              </Text>
            </View>
          ) : null}

          {subscription.subscriptionDate ? (
            <Text style={styles.metaText}>
              Started on {formatResetDate(subscription.subscriptionDate)}
            </Text>
          ) : null}
        </Card>

        <SectionHeading title="How Limits Apply">
          Plan limits are shown before each practice or test so you are not
          surprised.
        </SectionHeading>
        <Card>
          <View style={styles.limitRow}>
            <Text style={styles.limitLabel}>Practice sessions</Text>
            <Text style={styles.limitValue}>
              {usage.practiceCount}/
              {usage.practiceLimit == null ? "Unlimited" : usage.practiceLimit}
            </Text>
          </View>
          <View style={styles.limitRow}>
            <Text style={styles.limitLabel}>Full tests</Text>
            <Text style={styles.limitValue}>
              {usage.testCount}/{usage.testLimit == null ? "Unlimited" : usage.testLimit}
            </Text>
          </View>
          <Text style={styles.metaText}>
            Usage resets: {formatResetDate(usage.lastReset)}
          </Text>
        </Card>

        {features.length ? (
          <>
            <SectionHeading title="What You Get">
              Included with your current plan.
            </SectionHeading>
            <Card>
              {features.map((feature, index) => (
                <View key={`${feature}-${index}`} style={styles.featureRow}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color={colors.success}
                  />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <SectionHeading title="Manage Plan">
          Upgrade, compare plans, or use points-based discount coupons.
        </SectionHeading>
        <Card>
          <Button title="Open plan options" onPress={() => navigation.navigate("Profile")} />
          <View style={styles.inlineActions}>
            <TouchableOpacity
              style={[styles.inlineAction, { borderColor: colors.divider }]}
              onPress={() => navigation.navigate("Usage")}
            >
              <Ionicons name="bar-chart-outline" size={16} color={colors.primary} />
              <Text style={styles.inlineActionText}>View usage</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.inlineAction, { borderColor: colors.divider }]}
              onPress={() => navigation.navigate("RedeemDiscount")}
            >
              <Ionicons name="gift-outline" size={16} color={colors.primary} />
              <Text style={styles.inlineActionText}>Redeem points</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.metaText}>
            Trial starts with no card required. Billing starts only when you choose a paid
            plan.
          </Text>
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
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
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
    planHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
      gap: spacing.sm,
    },
    planBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
    },
    planBadgeText: {
      color: colors.primary,
      fontWeight: "700",
      textTransform: "capitalize",
    },
    statusPill: {
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    statusPillText: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "capitalize",
    },
    priceText: {
      fontSize: 28,
      color: colors.textPrimary,
      fontWeight: "700",
      marginBottom: spacing.xs,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    infoText: {
      color: colors.textSecondary,
      fontSize: 13,
      flexShrink: 1,
    },
    limitRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    limitLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    limitValue: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    featureText: {
      color: colors.textPrimary,
      flexShrink: 1,
    },
    inlineActions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    inlineAction: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    inlineActionText: {
      color: colors.textPrimary,
      fontWeight: "600",
      fontSize: 13,
    },
    metaText: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: spacing.xs,
    },
  });
