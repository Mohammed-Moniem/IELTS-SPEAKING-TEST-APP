import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "../../context";
import { useReferrals, useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";

export const ReferralsScreen: React.FC = () => {
  const { referralStats, loading, error, loadReferralCode, loadStats } =
    useReferrals();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const gradientColors = useMemo(
    () =>
      [
        colors.primary,
        colors.primaryStrong ?? colors.primary,
      ] as const,
    [colors]
  );

  useEffect(() => {
    loadReferralCode();
    loadStats();
  }, [loadReferralCode, loadStats]);

  const code = referralStats?.referralCode ?? "";
  const link = referralStats?.referralLink ?? "";
  const totalReferrals = referralStats?.totalReferrals ?? 0;
  const successfulReferrals = referralStats?.successfulReferrals ?? 0;
  const pendingReferrals = referralStats?.pendingReferrals ?? 0;
  const practiceSessions =
    referralStats?.lifetimeEarnings?.practiceSessionsGranted ?? 0;
  const simulationSessions =
    referralStats?.lifetimeEarnings?.simulationSessionsGranted ?? 0;
  const remainingToday = referralStats?.remainingToday ?? 0;
  const canReferToday = referralStats?.canReferToday ?? true;

  const referralsLeftMessage = canReferToday
    ? `You can invite ${remainingToday} more friend${
        remainingToday === 1 ? "" : "s"
      } today.`
    : "Daily limit reached. Come back tomorrow to invite more friends.";

  const handleCopyCode = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
  };

  const handleShareLink = async () => {
    if (!link) return;
    try {
      await Share.share({
        message: `Join me on Spokio! Use my code ${code} and we both get rewards. ${link}`,
        title: "Invite a friend",
      });
    } catch (error) {
      console.error("Failed to share referral link", error);
    }
  };

  if (loading && !referralStats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.heroTitle}>Refer &amp; earn sessions</Text>
            <Text style={styles.heroSubtitle}>
              Share your code with a friend and you both unlock free practice
              time.
            </Text>
          </View>
          <Ionicons name="people" size={36} color={colors.warning} />
        </View>

        <View style={styles.codeWrapper}>
          <Text style={styles.codeText}>{code}</Text>
        </View>

        <View style={styles.heroButtonsRow}>
          <TouchableOpacity
            style={styles.heroButton}
            onPress={handleCopyCode}
            activeOpacity={0.8}
          >
            <Ionicons name="copy" size={18} color={colors.primaryStrong ?? colors.primary} />
            <Text style={styles.heroButtonText}>Copy code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.heroButton, styles.shareButton]}
            onPress={handleShareLink}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={18} color={colors.primaryOn} />
            <Text style={[styles.heroButtonText, styles.shareButtonText]}>
              Share link
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View
        style={[
          styles.infoCard,
          {
            backgroundColor: canReferToday
              ? colors.successSoft
              : colors.warningSoft,
          },
        ]}
      >
        <Ionicons
          name={canReferToday ? "sparkles" : "time"}
          size={20}
          color={canReferToday ? colors.success : colors.warning}
        />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>
            {canReferToday ? "Keep inviting" : "Limit reached"}
          </Text>
          <Text style={styles.infoSubtitle}>{referralsLeftMessage}</Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="people" size={26} color={colors.primary} />
          <Text style={styles.statValue}>{totalReferrals}</Text>
          <Text style={styles.statLabel}>Total referrals</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={26} color={colors.success} />
          <Text style={styles.statValue}>{successfulReferrals}</Text>
          <Text style={styles.statLabel}>Successful</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="time" size={26} color={colors.warning} />
          <Text style={styles.statValue}>{pendingReferrals}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      <View style={styles.rewardsCard}>
        <Text style={styles.sectionTitle}>Lifetime rewards</Text>

        <View style={styles.rewardRow}>
          <View
            style={[
              styles.rewardIcon,
              { backgroundColor: colors.infoSoft },
            ]}
          >
            <Ionicons name="mic" size={20} color={colors.info} />
          </View>
          <View style={styles.rewardInfo}>
            <Text style={styles.rewardTitle}>Practice sessions</Text>
            <Text style={styles.rewardSubtitle}>
              {practiceSessions} sessions granted
            </Text>
          </View>
        </View>

        <View style={styles.rewardRow}>
          <View
            style={[
              styles.rewardIcon,
              { backgroundColor: colors.dangerSoft },
            ]}
          >
            <Ionicons name="school" size={20} color={colors.danger} />
          </View>
          <View style={styles.rewardInfo}>
            <Text style={styles.rewardTitle}>Simulation sessions</Text>
            <Text style={styles.rewardSubtitle}>
              {simulationSessions} sessions granted
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.stepsCard}>
        <Text style={styles.sectionTitle}>How it works</Text>

        <View style={styles.stepRow}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <Text style={styles.stepText}>Share your referral code or link.</Text>
        </View>
        <View style={styles.stepRow}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <Text style={styles.stepText}>Your friend signs up using the link.</Text>
        </View>
        <View style={styles.stepRow}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <Text style={styles.stepText}>
            You both earn 1 practice session instantly.
          </Text>
        </View>
        <View style={styles.stepRow}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>4</Text>
          </View>
          <Text style={styles.stepText}>
            After two successful referrals you also unlock a free simulation.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 24,
    padding: 20,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  heroTitle: {
    color: colors.primaryOn,
    fontSize: 22,
    fontWeight: "700",
  },
  heroSubtitle: {
    color: colors.primaryOn,
    opacity: 0.72,
    marginTop: 6,
    fontSize: 13,
    maxWidth: 230,
  },
  codeWrapper: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
  },
    codeText: {
      fontSize: 28,
      letterSpacing: 4,
      fontWeight: "700",
      color: colors.primaryOn,
    },
  heroButtonsRow: {
    flexDirection: "row",
    marginTop: 20,
    gap: 12,
  },
  heroButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  shareButton: {
    backgroundColor: colors.primaryStrong ?? colors.primary,
  },
  heroButtonText: {
    fontWeight: "600",
    color: colors.textPrimary,
  },
  shareButtonText: {
    color: colors.primaryOn,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  infoSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.dangerSoft,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    marginHorizontal: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 6,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rewardsCard: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rewardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  rewardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stepsCard: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 32,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    color: colors.primaryOn,
    fontWeight: "700",
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  });
