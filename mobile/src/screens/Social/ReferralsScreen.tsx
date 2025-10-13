import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useReferrals } from "../../hooks";

export const ReferralsScreen: React.FC = () => {
  const { referralStats, loading, loadReferralCode, loadStats } =
    useReferrals();

  useEffect(() => {
    loadReferralCode();
    loadStats();
  }, []);

  const handleCopyCode = async () => {
    if (referralStats?.referralCode) {
      await Clipboard.setStringAsync(referralStats.referralCode);
      // Show toast notification
    }
  };

  const handleShareLink = async () => {
    if (referralStats?.referralLink) {
      try {
        await Share.share({
          message: `Join me on IELTS Practice! Use my code ${referralStats.referralCode} and we both get rewards! ${referralStats.referralLink}`,
          title: "Join IELTS Practice",
        });
      } catch (error) {
        console.error("Failed to share:", error);
      }
    }
  };

  if (loading || !referralStats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Referral Code Card */}
      <View style={styles.codeCard}>
        <Text style={styles.codeTitle}>Your Referral Code</Text>
        <View style={styles.codeContainer}>
          <Text style={styles.code}>{referralStats.referralCode}</Text>
        </View>

        <View style={styles.codeActions}>
          <TouchableOpacity style={styles.codeButton} onPress={handleCopyCode}>
            <Ionicons name="copy-outline" size={20} color="#007AFF" />
            <Text style={styles.codeButtonText}>Copy Code</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.codeButton} onPress={handleShareLink}>
            <Ionicons name="share-outline" size={20} color="#007AFF" />
            <Text style={styles.codeButtonText}>Share Link</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Daily Limit */}
      {!referralStats.canReferToday && (
        <View style={styles.warningCard}>
          <Ionicons name="information-circle" size={24} color="#FF9500" />
          <Text style={styles.warningText}>
            Daily limit reached. You can refer {referralStats.remainingToday}{" "}
            more friends today.
          </Text>
        </View>
      )}

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="people" size={32} color="#007AFF" />
          <Text style={styles.statValue}>{referralStats.totalReferrals}</Text>
          <Text style={styles.statLabel}>Total Referrals</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={32} color="#34C759" />
          <Text style={styles.statValue}>
            {referralStats.successfulReferrals}
          </Text>
          <Text style={styles.statLabel}>Successful</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="time" size={32} color="#FF9500" />
          <Text style={styles.statValue}>{referralStats.pendingReferrals}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Rewards Earned */}
      <View style={styles.rewardsCard}>
        <Text style={styles.sectionTitle}>Rewards Earned</Text>

        <View style={styles.rewardRow}>
          <View style={styles.rewardIcon}>
            <Ionicons name="fitness" size={24} color="#5856D6" />
          </View>
          <View style={styles.rewardInfo}>
            <Text style={styles.rewardTitle}>Practice Sessions</Text>
            <Text style={styles.rewardDescription}>
              {referralStats.lifetimeEarnings.practiceSessionsGranted} sessions
              earned
            </Text>
          </View>
        </View>

        <View style={styles.rewardRow}>
          <View style={styles.rewardIcon}>
            <Ionicons name="school" size={24} color="#FF2D55" />
          </View>
          <View style={styles.rewardInfo}>
            <Text style={styles.rewardTitle}>Simulation Sessions</Text>
            <Text style={styles.rewardDescription}>
              {referralStats.lifetimeEarnings.simulationSessionsGranted}{" "}
              sessions earned
            </Text>
          </View>
        </View>
      </View>

      {/* How it Works */}
      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>How Referrals Work</Text>

        <View style={styles.infoStep}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <Text style={styles.stepText}>
            Share your referral code with friends
          </Text>
        </View>

        <View style={styles.infoStep}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <Text style={styles.stepText}>They sign up using your code</Text>
        </View>

        <View style={styles.infoStep}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <Text style={styles.stepText}>
            Earn 1 practice session per referral + 1 simulation after 2+
            referrals
          </Text>
        </View>

        <View style={styles.infoStep}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>4</Text>
          </View>
          <Text style={styles.stepText}>Maximum 5 referrals per day</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
  },
  codeCard: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  codeTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 16,
  },
  codeContainer: {
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  code: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#007AFF",
    letterSpacing: 4,
  },
  codeActions: {
    flexDirection: "row",
    gap: 12,
  },
  codeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  codeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: "#FF9500",
  },
  statsGrid: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000000",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 4,
    textAlign: "center",
  },
  rewardsCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 16,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  rewardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
  },
  rewardDescription: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: "#000000",
    paddingTop: 6,
  },
});
