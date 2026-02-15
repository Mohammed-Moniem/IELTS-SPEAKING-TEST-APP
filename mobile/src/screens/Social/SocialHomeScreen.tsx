import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { PointsPill } from "../../components/PointsPill";
import { ProfileMenu } from "../../components/ProfileMenu";
import { SocialDashboardSkeleton } from "../../components/skeletons/SocialSkeletons";
import { useTheme } from "../../context";
import {
  useAchievements,
  useChat,
  useFriends,
  useProfile,
  useThemedStyles,
} from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";

export const SocialHomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { friends, pendingRequests, loadFriends, loadPendingRequests } =
    useFriends();
  const { unreadCount, loadUnreadCount } = useChat();
  const { unlockedAchievements, loadUnlockedAchievements } = useAchievements();
  const { profile, loadMyProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadFriends(),
      loadPendingRequests(),
      loadUnreadCount(),
      loadUnlockedAchievements(),
      loadMyProfile(),
    ]);
    setLoading(false);
  }, [
    loadFriends,
    loadPendingRequests,
    loadUnreadCount,
    loadUnlockedAchievements,
    loadMyProfile,
  ]);

  useEffect(() => {
    loadData();
  }, []);

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (loading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SocialDashboardSkeleton />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Social</Text>
          <Text style={styles.headerSubtitle}>
            Level {profile?.level || 1} • {profile?.xp || 0} XP
          </Text>
        </View>
        <View style={styles.headerRight}>
          <PointsPill
            onPress={() => (navigation as any).navigate("PointsDetail")}
          />
          <ProfileMenu containerStyle={styles.profileMenuButton} />
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate("FriendsList")}
        >
          <Ionicons name="people" size={24} color={colors.primary} />
          <Text style={styles.statNumber}>{friends.length}</Text>
          <Text style={styles.statLabel}>Friends</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate("Conversations")}
        >
          <Ionicons name="chatbubbles" size={24} color={colors.success} />
          <Text style={styles.statNumber}>{unreadCount}</Text>
          <Text style={styles.statLabel}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate("Achievements")}
        >
          <Ionicons name="trophy" size={24} color={colors.warning} />
          <Text style={styles.statNumber}>{unlockedAchievements.length}</Text>
          <Text style={styles.statLabel}>Achievements</Text>
        </TouchableOpacity>
      </View>

      {/* Friend Requests */}
      {pendingRequests.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Friend Requests</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("FriendRequests")}
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {pendingRequests.length} pending request
              {pendingRequests.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("FindFriends")}
          >
            <Ionicons name="person-add" size={28} color={colors.primary} />
            <Text style={styles.actionText}>Find Friends</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("StudyGroups")}
          >
            <Ionicons name="people-circle" size={28} color={colors.info} />
            <Text style={styles.actionText}>Study Groups</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("Leaderboard")}
          >
            <Ionicons name="podium" size={28} color={colors.secondary} />
            <Text style={styles.actionText}>Leaderboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("Referrals")}
          >
            <Ionicons name="gift" size={28} color={colors.secondary} />
            <Text style={styles.actionText}>Referrals</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features</Text>

        <TouchableOpacity
          style={styles.featureItem}
          onPress={() => navigation.navigate("Conversations")}
        >
          <View style={styles.featureIcon}>
            <Ionicons name="chatbubbles" size={24} color={colors.success} />
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Messages</Text>
            <Text style={styles.featureDescription}>
              Chat with friends and study groups
            </Text>
          </View>
          {unreadCount > 0 && (
            <View style={styles.featureBadge}>
              <Text style={styles.featureBadgeText}>{unreadCount}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.featureItem}
          onPress={() => navigation.navigate("Achievements")}
        >
          <View style={styles.featureIcon}>
            <Ionicons name="trophy" size={24} color={colors.warning} />
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Achievements</Text>
            <Text style={styles.featureDescription}>
              Track your progress and earn rewards
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.featureItem}
          onPress={() => navigation.navigate("QRCodeScanner")}
        >
          <View style={styles.featureIcon}>
            <Ionicons name="qr-code" size={24} color={colors.primary} />
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Scan QR Code</Text>
            <Text style={styles.featureDescription}>
              Add friends quickly with QR codes
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.featureItem}
          onPress={() => navigation.navigate("QRCode")}
        >
          <View style={styles.featureIcon}>
            <Ionicons name="person-add" size={24} color={colors.success} />
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>My QR Code</Text>
            <Text style={styles.featureDescription}>
              Share your code for friends or referrals
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>
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
    content: {
      paddingBottom: 32,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      paddingTop: 60,
      backgroundColor: colors.surface,
    },
    headerTitle: {
      fontSize: 34,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileMenuButton: {
    marginRight: 0,
    paddingLeft: 0,
  },
  statsRow: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    statNumber: {
      fontSize: 24,
      fontWeight: "bold",
      marginTop: 8,
      color: colors.textPrimary,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
    sectionTitle: {
      fontSize: 22,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    seeAllText: {
      fontSize: 16,
      color: colors.primary,
    },
    badge: {
      backgroundColor: colors.danger,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      alignSelf: "flex-start",
    },
    badgeText: {
      color: colors.dangerOn,
      fontSize: 14,
      fontWeight: "600",
    },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
    actionCard: {
      width: "48%",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      alignItems: "center",
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    actionText: {
      fontSize: 14,
      fontWeight: "600",
      marginTop: 8,
      textAlign: "center",
      color: colors.textPrimary,
    },
    featureItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    featureIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceSubtle,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
  featureContent: {
    flex: 1,
  },
    featureTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    featureDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    featureBadge: {
      backgroundColor: colors.danger,
      borderRadius: 12,
      minWidth: 24,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
      marginRight: 8,
    },
    featureBadgeText: {
      color: colors.dangerOn,
      fontSize: 12,
      fontWeight: "600",
    },
  });
