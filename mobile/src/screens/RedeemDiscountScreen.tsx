/**
 * RedeemDiscountScreen
 * Allows users to redeem points for subscription discounts
 * Shows all tiers, current balance, and handles redemption flow
 */

import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../context";
import { usePoints, useThemedStyles } from "../hooks";
import { DiscountTier, pointsService } from "../services/api";
import firebaseAnalyticsService from "../services/firebaseAnalyticsService";
import monitoringService from "../services/monitoringService";
import { toastService } from "../services/toastService";
import type { ColorTokens } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { logger } from "../utils/logger";

interface TierCardProps {
  tier: DiscountTier;
  name: string;
  pointsRequired: number;
  discountPercentage: number;
  userBalance: number;
  isSelected: boolean;
  onSelect: () => void;
  colors: ColorTokens;
  styles: ReturnType<typeof createStyles>;
}

const TierCard: React.FC<TierCardProps> = ({
  tier,
  name,
  pointsRequired,
  discountPercentage,
  userBalance,
  isSelected,
  onSelect,
  colors,
  styles,
}) => {
  const isLocked = userBalance < pointsRequired;
  const isCurrentTier = !isLocked && userBalance >= pointsRequired;

  const getTierColor = () => {
    switch (tier) {
      case DiscountTier.BRONZE:
        return "#CD7F32";
      case DiscountTier.SILVER:
        return "#C0C0C0";
      case DiscountTier.GOLD:
        return "#FFD700";
      case DiscountTier.PLATINUM:
        return "#E5E4E2";
      default:
        return colors.primary;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.tierCard,
        isSelected && styles.tierCardSelected,
        isLocked && styles.tierCardLocked,
      ]}
      onPress={onSelect}
      disabled={isLocked}
      activeOpacity={0.7}
    >
      <View style={styles.tierHeader}>
        <View style={[styles.tierBadge, { backgroundColor: getTierColor() }]}>
          <Ionicons
            name={isLocked ? "lock-closed" : "star"}
            size={24}
            color="#fff"
          />
        </View>
        <View style={styles.tierInfo}>
          <Text style={styles.tierName}>{name}</Text>
          <Text style={styles.tierDiscount}>{discountPercentage}% OFF</Text>
        </View>
        {isSelected && !isLocked && (
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
        )}
      </View>

      <View style={styles.tierDetails}>
        <View style={styles.tierDetailRow}>
          <Ionicons
            name="diamond-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={styles.tierDetailText}>
            {pointsRequired.toLocaleString()} points required
          </Text>
        </View>

        {isLocked && (
          <View style={styles.lockedBanner}>
            <Text style={styles.lockedText}>
              Need {(pointsRequired - userBalance).toLocaleString()} more points
            </Text>
          </View>
        )}

        {isCurrentTier && !isLocked && (
          <View style={styles.availableBanner}>
            <Text style={styles.availableText}>✓ Available to redeem</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export const RedeemDiscountScreen: React.FC<{ navigation: any }> = ({
  navigation,
}) => {
  const { balance, loading, redeemDiscount } = usePoints();
  const [selectedTier, setSelectedTier] = useState<DiscountTier | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [couponModalVisible, setCouponModalVisible] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const allTiers = pointsService.getAllDiscountTiers();

  // Track screen view on mount
  useEffect(() => {
    monitoringService.trackScreen("RedeemDiscount", {
      balance,
      availableTiers: allTiers.filter((t) => balance >= t.pointsRequired)
        .length,
    });
    void firebaseAnalyticsService.trackScreen("RedeemDiscount", {
      balance,
      availableTiers: allTiers.filter((t) => balance >= t.pointsRequired)
        .length,
    });
  }, [balance, allTiers]);

  const handleRedeem = async () => {
    if (!selectedTier) {
      toastService.warning("Please select a discount tier");
      return;
    }

    const tierInfo = pointsService.getDiscountTierInfo(selectedTier);

    Alert.alert(
      "Confirm Redemption",
      `Redeem ${tierInfo.pointsRequired.toLocaleString()} points for ${
        tierInfo.discountPercentage
      }% off?\n\nYour new balance will be: ${(
        balance - tierInfo.pointsRequired
      ).toLocaleString()} pts`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Redeem",
          style: "default",
          onPress: async () => {
            setIsRedeeming(true);
            try {
              const result = await redeemDiscount(selectedTier);
              if (result) {
                logger.success("Discount redeemed successfully", result);
                setCouponCode(result.couponCode);
                setCouponModalVisible(true);
                toastService.discountRedeemed(
                  tierInfo.name,
                  tierInfo.discountPercentage
                );
                setSelectedTier(null);
              }
            } catch (error: any) {
              logger.error("Failed to redeem discount", error);
              toastService.error(error.message || "Failed to redeem discount");
            } finally {
              setIsRedeeming(false);
            }
          },
        },
      ]
    );
  };

  const handleCopyCoupon = async () => {
    await Clipboard.setStringAsync(couponCode);
    toastService.success("Coupon code copied!");
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
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
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Redeem Discount</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Your Points Balance</Text>
          <Text style={styles.balanceValue}>
            {balance.toLocaleString()} pts
          </Text>
          <Text style={styles.balanceHint}>
            Redeem points for subscription discounts
          </Text>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons
            name="information-circle"
            size={20}
            color={colors.primary}
          />
          <Text style={styles.infoText}>
            Discount coupons are valid for 30 days and can be used on any
            subscription plan
          </Text>
        </View>

        {/* Tier Selection */}
        <Text style={styles.sectionTitle}>Select Discount Tier</Text>
        <View style={styles.tiersList}>
          {allTiers.map((tierInfo) => (
            <TierCard
              key={tierInfo.tier}
              tier={tierInfo.tier}
              name={tierInfo.name}
              pointsRequired={tierInfo.pointsRequired}
              discountPercentage={tierInfo.discountPercentage}
              userBalance={balance}
              isSelected={selectedTier === tierInfo.tier}
              onSelect={() => setSelectedTier(tierInfo.tier)}
              colors={colors}
              styles={styles}
            />
          ))}
        </View>

        {/* Redeem Button */}
        <TouchableOpacity
          style={[
            styles.redeemButton,
            (!selectedTier || isRedeeming) && styles.redeemButtonDisabled,
          ]}
          onPress={handleRedeem}
          disabled={!selectedTier || isRedeeming}
          activeOpacity={0.8}
        >
          {isRedeeming ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="gift" size={20} color="#fff" />
              <Text style={styles.redeemButtonText}>Redeem Discount</Text>
            </>
          )}
        </TouchableOpacity>

        {/* How to Earn More */}
        <View style={styles.earnMoreCard}>
          <Text style={styles.earnMoreTitle}>How to Earn More Points</Text>
          <View style={styles.earnMoreList}>
            <View style={styles.earnMoreItem}>
              <Ionicons name="mic" size={18} color={colors.primary} />
              <Text style={styles.earnMoreText}>
                Complete practice sessions (20-50 pts)
              </Text>
            </View>
            <View style={styles.earnMoreItem}>
              <Ionicons name="trophy" size={18} color={colors.primary} />
              <Text style={styles.earnMoreText}>
                Unlock achievements (50-200 pts)
              </Text>
            </View>
            <View style={styles.earnMoreItem}>
              <Ionicons name="people" size={18} color={colors.primary} />
              <Text style={styles.earnMoreText}>
                Refer friends (100 pts per referral)
              </Text>
            </View>
            <View style={styles.earnMoreItem}>
              <Ionicons name="person" size={18} color={colors.primary} />
              <Text style={styles.earnMoreText}>
                Complete your profile (50 pts)
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Coupon Success Modal */}
      <Modal
        visible={couponModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCouponModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons
                name="checkmark-circle"
                size={64}
                color={colors.success}
              />
            </View>
            <Text style={styles.modalTitle}>Discount Unlocked! 🎉</Text>
            <Text style={styles.modalDescription}>
              Your coupon code has been generated. Use it at checkout to apply
              your discount.
            </Text>

            <View style={styles.couponCodeContainer}>
              <Text style={styles.couponCodeLabel}>Coupon Code:</Text>
              <View style={styles.couponCodeBox}>
                <Text style={styles.couponCode}>{couponCode}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyCoupon}
              activeOpacity={0.7}
            >
              <Ionicons name="copy-outline" size={20} color={colors.primary} />
              <Text style={styles.copyButtonText}>Copy Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setCouponModalVisible(false)}
            >
              <Text style={styles.closeModalButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  balanceHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  infoBanner: {
    flexDirection: "row",
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.primary,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  tiersList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  tierCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  tierCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  tierCardLocked: {
    opacity: 0.6,
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  tierBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  tierDiscount: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.success,
  },
  tierDetails: {
    gap: spacing.sm,
  },
  tierDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  tierDetailText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  lockedBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 8,
    padding: spacing.sm,
  },
  lockedText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: "500",
  },
  availableBanner: {
    backgroundColor: colors.successSoft,
    borderRadius: 8,
    padding: spacing.sm,
  },
  availableText: {
    fontSize: 12,
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
  redeemButtonDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.5,
  },
  redeemButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  earnMoreCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  earnMoreTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  earnMoreList: {
    gap: spacing.sm,
  },
  earnMoreItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  earnMoreText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.xxl,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  modalIconContainer: {
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  couponCodeContainer: {
    width: "100%",
    marginBottom: spacing.md,
  },
  couponCodeLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  couponCodeBox: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
  },
  couponCode: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
    textAlign: "center",
    letterSpacing: 2,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  copyButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "500",
  },
  closeModalButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    width: "100%",
  },
  closeModalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  });
