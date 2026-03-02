/**
 * PointsDetailScreen
 * Full dashboard showing points balance, tier progress, and transaction history
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../context";
import { usePoints } from "../hooks";
import { useThemedStyles } from "../hooks";
import { PointsTransaction } from "../services/api";
import firebaseAnalyticsService from "../services/firebaseAnalyticsService";
import monitoringService from "../services/monitoringService";
import type { ColorTokens } from "../theme/tokens";
import { spacing } from "../theme/tokens";

export const PointsDetailScreen: React.FC<{ navigation: any }> = ({
  navigation,
}) => {
  const {
    balance,
    totalEarned,
    totalRedeemed,
    currentTierName,
    nextTier,
    transactions,
    loading,
    error,
    refresh,
    fetchTransactions,
  } = usePoints();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const renderTransactionItem = ({
    item,
  }: {
    item: PointsTransaction;
  }) => {
    const isPositive = item.amount > 0;

    const getIcon = () => {
      switch (item.type) {
        case "practice_completion":
          return "mic";
        case "achievement_unlock":
          return "trophy";
        case "referral_reward":
          return "people";
        case "discount_redemption":
          return "gift";
        case "profile_completion":
          return "person";
        default:
          return "star";
      }
    };

    return (
      <View style={styles.transactionItem}>
        <View
          style={[
            styles.transactionIcon,
            {
              backgroundColor: isPositive
                ? colors.successSoft
                : colors.dangerSoft,
            },
          ]}
        >
          <Ionicons
            name={getIcon() as any}
            size={20}
            color={isPositive ? colors.success : colors.danger}
          />
        </View>

        <View style={styles.transactionDetails}>
          <Text style={styles.transactionDescription}>
            {item.description}
          </Text>
          <Text style={styles.transactionDate}>
            {new Date(item.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        <View style={styles.transactionAmountContainer}>
          <Text
            style={[
              styles.transactionAmount,
              { color: isPositive ? colors.success : colors.danger },
            ]}
          >
            {isPositive ? "+" : "-"}
            {Math.abs(item.amount).toLocaleString()}
          </Text>
          <Text style={styles.transactionType}>{item.type}</Text>
        </View>
      </View>
    );
  };

  const [filter, setFilter] = useState<"all" | "earned" | "redeemed">("all");
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Track screen view on mount
  useEffect(() => {
    monitoringService.trackScreen("PointsDetail", {
      balance,
      currentTier: currentTierName,
    });
    void firebaseAnalyticsService.trackScreen("PointsDetail", {
      balance,
      currentTier: currentTierName,
    });
  }, [balance, currentTierName]);

  const filteredTransactions = transactions.filter((t) => {
    if (filter === "earned") return t.amount > 0;
    if (filter === "redeemed") return t.amount < 0;
    return true;
  });

  const handleLoadMore = async () => {
    if (isLoadingMore || loading) return;
    setIsLoadingMore(true);
    try {
      await fetchTransactions(transactions.length + 20);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const getTierProgress = () => {
    if (!nextTier) return 100; // Max tier reached
    const currentPoints = balance;
    const nextTierPoints = Math.max(nextTier.pointsRequired ?? 0, 1);
    const remaining = Math.max(nextTier.pointsRemaining ?? 0, 0);
    const previousTierPoints = Math.max(nextTierPoints - remaining, 0);
    const denominator = Math.max(nextTierPoints - previousTierPoints, 1);
    const progress = ((currentPoints - previousTierPoints) / denominator) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityHint="Return to the previous screen"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Points</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={refresh}
            accessibilityRole="button"
            accessibilityLabel="Retry points loading"
            accessibilityHint="Try loading points data again"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Return to the previous screen"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Points</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item._id}
        renderItem={renderTransactionItem}
        ListHeaderComponent={
          <>
            {/* Balance Card */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceIconContainer}>
                <Ionicons name="star" size={32} color={colors.warning} />
              </View>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              <Text style={styles.balanceValue}>
                {balance.toLocaleString()}
              </Text>
              <Text style={styles.balanceSubtext}>points</Text>

              {/* Stats Row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {totalEarned.toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>Total Earned</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {totalRedeemed.toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>Total Redeemed</Text>
                </View>
              </View>
            </View>

            {/* Tier Progress Card */}
            <View style={styles.tierCard}>
              <View style={styles.tierHeader}>
                <View style={styles.tierBadge}>
                  <Ionicons name="trophy" size={24} color={colors.primary} />
                </View>
                <View style={styles.tierInfo}>
                  <Text style={styles.tierLabel}>Current Tier</Text>
                  <Text style={styles.tierName}>
                    {currentTierName || "No Tier"}
                  </Text>
                </View>
              </View>

              {nextTier && (
                <>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${getTierProgress()}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.progressText}>
                    {(nextTier.pointsRemaining ?? 0).toLocaleString()} pts to{" "}
                    {nextTier.name}
                  </Text>
                </>
              )}

              {!nextTier && (
                <View style={styles.maxTierBanner}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.success}
                  />
                  <Text style={styles.maxTierText}>
                    Maximum tier reached! 🎉
                  </Text>
                </View>
              )}
            </View>

            {/* Redeem Button */}
            <TouchableOpacity
              style={styles.redeemButton}
              onPress={() => navigation.navigate("RedeemDiscount")}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Redeem points for discount"
              accessibilityHint="Open discount redemption options"
            >
              <Ionicons name="gift" size={20} color={colors.primaryOn} />
              <Text style={styles.redeemButtonText}>Redeem for Discount</Text>
            </TouchableOpacity>

            {/* Filter Tabs */}
            <View style={styles.filterTabs}>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  filter === "all" && styles.filterTabActive,
                ]}
                onPress={() => setFilter("all")}
                accessibilityRole="button"
                accessibilityLabel="Show all transactions"
                accessibilityHint="Display both earned and redeemed points"
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filter === "all" && styles.filterTabTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  filter === "earned" && styles.filterTabActive,
                ]}
                onPress={() => setFilter("earned")}
                accessibilityRole="button"
                accessibilityLabel="Show earned transactions"
                accessibilityHint="Display only points you earned"
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filter === "earned" && styles.filterTabTextActive,
                  ]}
                >
                  Earned
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  filter === "redeemed" && styles.filterTabActive,
                ]}
                onPress={() => setFilter("redeemed")}
                accessibilityRole="button"
                accessibilityLabel="Show redeemed transactions"
                accessibilityHint="Display only points you spent"
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filter === "redeemed" && styles.filterTabTextActive,
                  ]}
                >
                  Redeemed
                </Text>
              </TouchableOpacity>
            </View>

            {/* Transaction History Header */}
            <Text style={styles.sectionTitle}>Transaction History</Text>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="document-text-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>
                Earn points by completing practice sessions and unlocking
                achievements
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
      />
    </View>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  listContent: {
    padding: spacing.md,
  },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.warningSoft,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  balanceValue: {
    fontSize: 48,
    fontWeight: "bold",
    color: colors.primary,
  },
  balanceSubtext: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  tierCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  tierBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  tierInfo: {
    flex: 1,
  },
  tierLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  tierName: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  progressContainer: {
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
  maxTierBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.successSoft,
    borderRadius: 8,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  maxTierText: {
    fontSize: 13,
    color: colors.success,
    fontWeight: "500",
  },
  redeemButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  redeemButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primaryOn,
  },
  filterTabs: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.xxs,
    marginBottom: spacing.md,
    gap: spacing.xxs,
  },
  filterTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    alignItems: "center",
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.primaryOn,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  transactionAmountContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "600",
  },
  transactionType: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: "capitalize",
    marginTop: spacing.xxs,
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: "center",
  },
  loadingMore: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorText: {
    fontSize: 16,
    color: colors.danger,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primaryOn,
  },
  });
