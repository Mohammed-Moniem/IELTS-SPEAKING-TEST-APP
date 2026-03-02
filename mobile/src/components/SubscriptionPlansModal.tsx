import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import type { SubscriptionPlan } from "../types/api";
import type { ColorTokens } from "../theme/tokens";
import { spacing } from "../theme/tokens";

export interface SubscriptionPlanOption {
  tier: SubscriptionPlan;
  name: string;
  price: number;
  currency?: string;
  description?: string;
  features?: string[];
  limits?: {
    practice?: number | null;
    simulation?: number | null;
  };
}

interface SubscriptionPlansModalProps {
  visible: boolean;
  plans: SubscriptionPlanOption[];
  currentTier?: SubscriptionPlan | string;
  loading?: boolean;
  onClose: () => void;
  onSelectPlan: (
    plan: SubscriptionPlanOption,
    options?: { couponCode?: string }
  ) => void;
}

const formatLimit = (value?: number | null) => {
  if (value === null || value === undefined) {
    return "Unlimited";
  }
  if (value <= 0) {
    return "Not included";
  }
  return `${value} / month`;
};

export const SubscriptionPlansModal: React.FC<
  SubscriptionPlansModalProps
> = ({ visible, plans, currentTier, loading, onClose, onSelectPlan }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [couponCode, setCouponCode] = useState("");

  useEffect(() => {
    if (!visible) {
      setCouponCode("");
    }
  }, [visible]);

  const orderedPlans = useMemo(() => {
    return [...plans].sort((a, b) => a.price - b.price);
  }, [plans]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Choose your plan</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {currentTier ? (
            <View style={styles.currentPlanBadge}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.currentPlanText}>
                Current plan: {currentTier.toString().toUpperCase()}
              </Text>
            </View>
          ) : null}

          <View style={styles.couponCard}>
            <Text style={styles.couponLabel}>Have a coupon?</Text>
            <TextInput
              value={couponCode}
              autoCapitalize="characters"
              onChangeText={setCouponCode}
              placeholder="Enter code"
              placeholderTextColor={colors.textMuted}
              style={styles.couponInput}
            />
            <Text style={styles.couponHint}>
              Enter your discount code before selecting a plan.
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            orderedPlans.map((plan) => {
              const isCurrentPlan =
                currentTier && plan.tier.toLowerCase() === currentTier.toLowerCase();
              const currency = plan.currency ?? "$";
              const features = plan.features ?? [];

              return (
                <View key={plan.tier} style={styles.planCard}>
                  <View style={styles.planHeader}>
                    <View style={styles.planTitleRow}>
                      <Ionicons
                        name={
                          plan.tier === "pro"
                            ? "diamond"
                            : plan.tier === "premium"
                            ? "star"
                            : "gift"
                        }
                        size={26}
                        color={
                          plan.tier === "pro"
                            ? colors.warning
                            : plan.tier === "premium"
                            ? colors.primary
                            : colors.textSecondary
                        }
                      />
                      <View>
                        <Text style={styles.planName}>{plan.name}</Text>
                        {plan.description ? (
                          <Text style={styles.planDescription}>{plan.description}</Text>
                        ) : null}
                      </View>
                    </View>
                    {isCurrentPlan ? (
                      <View style={[styles.statusPill, { backgroundColor: colors.successSoft }]}>
                        <Text style={[styles.statusPillText, { color: colors.success }]}>
                          ACTIVE
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.priceRow}>
                    {plan.price === 0 ? (
                      <Text style={styles.priceFree}>Free</Text>
                    ) : (
                      <>
                        <Text style={styles.priceCurrency}>{currency}</Text>
                        <Text style={styles.priceValue}>{plan.price}</Text>
                        <Text style={styles.pricePeriod}>/month</Text>
                      </>
                    )}
                  </View>

                  <View style={styles.limitsContainer}>
                    <Text style={styles.limitsTitle}>Monthly limits</Text>
                    <View style={styles.limitRow}>
                      <Text style={styles.limitLabel}>Practice</Text>
                      <Text style={styles.limitValue}>
                        {formatLimit(plan.limits?.practice)}
                      </Text>
                    </View>
                    <View style={styles.limitRow}>
                      <Text style={styles.limitLabel}>Simulations</Text>
                      <Text style={styles.limitValue}>
                        {formatLimit(plan.limits?.simulation)}
                      </Text>
                    </View>
                  </View>

                  {features.length ? (
                    <View style={styles.featuresList}>
                      {features.map((feature) => (
                        <View key={feature} style={styles.featureRow}>
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color={colors.success}
                          />
                          <Text style={styles.featureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {!isCurrentPlan && (
                    <TouchableOpacity
                      style={[styles.selectButton, { backgroundColor: colors.primary }]}
                      onPress={() =>
                        onSelectPlan(plan, {
                          couponCode: couponCode.trim() || undefined,
                        })
                      }
                    >
                      <Text style={[styles.selectButtonText, { color: colors.primaryOn }]}>
                        {plan.price === 0 ? "Switch to plan" : "Upgrade to plan"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    closeButton: {
      padding: spacing.xs,
      borderRadius: spacing.md,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl * 2,
    },
    currentPlanBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      backgroundColor: colors.successSoft,
      padding: spacing.sm,
      borderRadius: spacing.lg,
      marginBottom: spacing.lg,
    },
    currentPlanText: {
      fontWeight: "600",
      color: colors.success,
    },
    couponCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: spacing.lg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      backgroundColor: colors.surface,
    },
    couponLabel: {
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    couponInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      fontWeight: "600",
      letterSpacing: 1,
    },
    couponHint: {
      marginTop: spacing.xs,
      fontSize: 12,
      color: colors.textSecondary,
    },
    loadingContainer: {
      paddingVertical: spacing.xl,
      alignItems: "center",
    },
    planCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: spacing.xl,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      marginBottom: spacing.lg,
      shadowColor: colors.textPrimary,
      shadowOpacity: 0.05,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 12,
      elevation: 2,
    },
    planHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    planTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    planName: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    planDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    statusPill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: spacing.lg,
    },
    statusPillText: {
      fontSize: 12,
      fontWeight: "700",
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 2,
      marginBottom: spacing.md,
    },
    priceFree: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    priceCurrency: {
      fontSize: 18,
      color: colors.textSecondary,
    },
    priceValue: {
      fontSize: 32,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    pricePeriod: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    limitsContainer: {
      marginBottom: spacing.md,
      borderTopWidth: 1,
      borderColor: colors.border,
      paddingTop: spacing.sm,
    },
    limitsTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    limitRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    limitLabel: {
      color: colors.textSecondary,
    },
    limitValue: {
      fontWeight: "600",
      color: colors.textPrimary,
    },
    featuresList: {
      marginBottom: spacing.lg,
      gap: spacing.xs,
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    featureText: {
      color: colors.textSecondary,
      flex: 1,
    },
    selectButton: {
      paddingVertical: spacing.md,
      borderRadius: spacing.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    selectButtonText: {
      fontSize: 16,
      fontWeight: "600",
    },
  });
