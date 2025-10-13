import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { SubscriptionPlan } from "../api/subscriptionApi";

interface SubscriptionPlansModalProps {
  visible: boolean;
  plans: SubscriptionPlan[];
  currentTier: string;
  onClose: () => void;
  onSelectPlan: (tier: "free" | "premium" | "pro") => void;
}

export const SubscriptionPlansModal: React.FC<SubscriptionPlansModalProps> = ({
  visible,
  plans,
  currentTier,
  onClose,
  onSelectPlan,
}) => {
  const getTierColor = (tier: string): string => {
    switch (tier) {
      case "premium":
        return "#3b82f6";
      case "pro":
        return "#d4a745";
      default:
        return "#64748b";
    }
  };

  const getTierIcon = (tier: string): string => {
    switch (tier) {
      case "premium":
        return "star";
      case "pro":
        return "diamond";
      default:
        return "gift";
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Choose Your Plan</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Current Plan Badge */}
          {currentTier && currentTier !== "free" && (
            <View style={styles.currentPlanBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.currentPlanText}>
                Current Plan:{" "}
                {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
              </Text>
            </View>
          )}

          {/* Plans */}
          {plans.map((plan) => {
            const isCurrentPlan = plan.tier === currentTier;
            const tierColor = getTierColor(plan.tier);

            return (
              <View
                key={plan.tier}
                style={[
                  styles.planCard,
                  isCurrentPlan && styles.planCardActive,
                  { borderColor: tierColor },
                ]}
              >
                {/* Plan Header */}
                <View style={styles.planHeader}>
                  <View style={styles.planTitleRow}>
                    <Ionicons
                      name={getTierIcon(plan.tier) as any}
                      size={28}
                      color={tierColor}
                    />
                    <Text style={[styles.planName, { color: tierColor }]}>
                      {plan.name}
                    </Text>
                  </View>

                  {isCurrentPlan && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>ACTIVE</Text>
                    </View>
                  )}
                </View>

                {/* Price */}
                <View style={styles.priceContainer}>
                  {plan.price === 0 ? (
                    <Text style={styles.priceText}>Free</Text>
                  ) : (
                    <>
                      <Text style={styles.priceSymbol}>$</Text>
                      <Text style={styles.priceText}>{plan.price}</Text>
                      <Text style={styles.pricePeriod}>/month</Text>
                    </>
                  )}
                </View>

                {/* Features */}
                <View style={styles.featuresContainer}>
                  {plan.features.map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#10b981"
                      />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                {/* Usage Limits */}
                <View style={styles.limitsContainer}>
                  <Text style={styles.limitsTitle}>Monthly Limits:</Text>
                  <Text style={styles.limitText}>
                    Practice:{" "}
                    {plan.limits.practiceSessionsPerMonth === -1
                      ? "Unlimited"
                      : `${plan.limits.practiceSessionsPerMonth} sessions`}
                  </Text>
                  <Text style={styles.limitText}>
                    Simulation:{" "}
                    {plan.limits.simulationSessionsPerMonth === -1
                      ? "Unlimited"
                      : plan.limits.simulationSessionsPerMonth === 0
                      ? "Not included"
                      : `${plan.limits.simulationSessionsPerMonth} tests`}
                  </Text>
                </View>

                {/* Action Button */}
                {!isCurrentPlan && (
                  <TouchableOpacity
                    style={[
                      styles.selectButton,
                      { backgroundColor: tierColor },
                    ]}
                    onPress={() => onSelectPlan(plan.tier)}
                  >
                    <Text style={styles.selectButtonText}>
                      {plan.tier === "free" ? "Downgrade to " : "Upgrade to "}
                      {plan.name}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  currentPlanBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  currentPlanText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10b981",
  },
  planCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 2,
  },
  planCardActive: {
    backgroundColor: "rgba(59, 130, 246, 0.05)",
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  planTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  planName: {
    fontSize: 28,
    fontWeight: "700",
  },
  activeBadge: {
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 20,
  },
  priceSymbol: {
    fontSize: 24,
    fontWeight: "700",
    color: "#d4a745",
  },
  priceText: {
    fontSize: 48,
    fontWeight: "700",
    color: "#d4a745",
  },
  pricePeriod: {
    fontSize: 18,
    color: "#94a3b8",
    marginLeft: 4,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  featureText: {
    fontSize: 15,
    color: "#e2e8f0",
    flex: 1,
  },
  limitsContainer: {
    backgroundColor: "rgba(100, 116, 139, 0.1)",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  limitsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 8,
  },
  limitText: {
    fontSize: 14,
    color: "#cbd5e1",
    marginBottom: 4,
  },
  selectButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
