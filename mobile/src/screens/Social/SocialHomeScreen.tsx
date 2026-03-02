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
  useStudyGroups,
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
  const { invites, loadInvites } = useStudyGroups();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const loadData = useCallback(async (blocking: boolean = false) => {
    if (blocking) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    await Promise.allSettled([
      loadFriends(),
      loadPendingRequests(),
      loadUnreadCount(),
      loadUnlockedAchievements(),
      loadMyProfile(),
      loadInvites(),
    ]);

    if (blocking) {
      setLoading(false);
    } else {
      setRefreshing(false);
    }
  }, [
    loadFriends,
    loadPendingRequests,
    loadUnreadCount,
    loadUnlockedAchievements,
    loadMyProfile,
    loadInvites,
  ]);

  useEffect(() => {
    void loadData(true);
  }, []);

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      void loadData(false);
    }, [loadData])
  );

  const primaryAction = pendingRequests.length
    ? {
        title: `Review ${pendingRequests.length} request${
          pendingRequests.length === 1 ? "" : "s"
        }`,
        subtitle: "Respond quickly to keep your network active.",
        onPress: () => navigation.navigate("FriendRequests"),
      }
    : unreadCount > 0
    ? {
        title: `Open ${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`,
        subtitle: "Continue your latest IELTS conversations.",
        onPress: () => navigation.navigate("Conversations"),
      }
    : invites.length > 0
    ? {
        title: `Review ${invites.length} study invite${
          invites.length === 1 ? "" : "s"
        }`,
        subtitle: "Join active groups that match your test goals.",
        onPress: () => navigation.navigate("StudyGroups"),
      }
    : {
        title: "Find a study partner",
        subtitle: "Discover learners with a similar target band.",
        onPress: () => navigation.navigate("FindFriends"),
      };

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

      {refreshing ? (
        <Text style={styles.refreshingText}>Updating social activity...</Text>
      ) : null}

      <View style={styles.hubCard}>
        <Text style={styles.hubTitle}>Action hub</Text>
        <Text style={styles.hubSubtitle}>{primaryAction.subtitle}</Text>
        <TouchableOpacity
          style={styles.hubPrimaryAction}
          onPress={primaryAction.onPress}
          accessibilityRole="button"
          accessibilityLabel={primaryAction.title}
          accessibilityHint={primaryAction.subtitle}
        >
          <Text style={styles.hubPrimaryActionText}>{primaryAction.title}</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primaryOn} />
        </TouchableOpacity>
        <View style={styles.hubChipRow}>
          <TouchableOpacity
            style={styles.hubChip}
            onPress={() => navigation.navigate("Conversations")}
            accessibilityRole="button"
            accessibilityLabel={`Unread messages ${unreadCount}`}
            accessibilityHint="Open conversations and review unread messages"
          >
            <Text style={styles.hubChipText}>
              Unread: {unreadCount}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.hubChip}
            onPress={() => navigation.navigate("FriendRequests")}
            accessibilityRole="button"
            accessibilityLabel={`Pending friend requests ${pendingRequests.length}`}
            accessibilityHint="Open pending friend requests"
          >
            <Text style={styles.hubChipText}>
              Pending: {pendingRequests.length}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.hubChip}
            onPress={() => navigation.navigate("StudyGroups")}
            accessibilityRole="button"
            accessibilityLabel={`Study group invites ${invites.length}`}
            accessibilityHint="Open study groups and review invites"
          >
            <Text style={styles.hubChipText}>Invites: {invites.length}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate("FriendsList")}
          accessibilityRole="button"
          accessibilityLabel={`Friends ${friends.length}`}
          accessibilityHint="Open your friends list"
        >
          <Ionicons name="people" size={24} color={colors.primary} />
          <Text style={styles.statNumber}>{friends.length}</Text>
          <Text style={styles.statLabel}>Friends</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate("Conversations")}
          accessibilityRole="button"
          accessibilityLabel={`Messages ${unreadCount}`}
          accessibilityHint="Open chat conversations"
        >
          <Ionicons name="chatbubbles" size={24} color={colors.success} />
          <Text style={styles.statNumber}>{unreadCount}</Text>
          <Text style={styles.statLabel}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate("Achievements")}
          accessibilityRole="button"
          accessibilityLabel={`Achievements ${unlockedAchievements.length}`}
          accessibilityHint="Open your achievements"
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
              accessibilityRole="button"
              accessibilityLabel="See all friend requests"
              accessibilityHint="Open the full friend requests list"
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
        <Text style={styles.sectionTitle}>Top Actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("FindFriends")}
            accessibilityRole="button"
            accessibilityLabel="Find friends"
            accessibilityHint="Search for new friends to practice with"
          >
            <Ionicons name="person-add" size={28} color={colors.primary} />
            <Text style={styles.actionText}>Find Friends</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("StudyGroups")}
            accessibilityRole="button"
            accessibilityLabel="Study groups"
            accessibilityHint="Browse and join IELTS study groups"
          >
            <Ionicons name="people-circle" size={28} color={colors.info} />
            <Text style={styles.actionText}>Study Groups</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features</Text>

        <TouchableOpacity
          style={styles.featureItem}
          onPress={() => navigation.navigate("Conversations")}
          accessibilityRole="button"
          accessibilityLabel="Messages"
          accessibilityHint="Open chat with friends and study groups"
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
          accessibilityRole="button"
          accessibilityLabel="Achievements"
          accessibilityHint="Open achievements and progress rewards"
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
          accessibilityRole="button"
          accessibilityLabel="Scan QR code"
          accessibilityHint="Open camera scanner to add friends"
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
          accessibilityRole="button"
          accessibilityLabel="My QR code"
          accessibilityHint="Show your QR code to share with others"
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
    refreshingText: {
      color: colors.textMuted,
      fontSize: 12,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    hubCard: {
      backgroundColor: colors.surface,
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: 14,
      gap: 10,
    },
    hubTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    hubSubtitle: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    hubPrimaryAction: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    hubPrimaryActionText: {
      color: colors.primaryOn,
      fontWeight: "700",
      fontSize: 14,
    },
    hubChipRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    hubChip: {
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    hubChipText: {
      color: colors.textMutedStrong,
      fontWeight: "600",
      fontSize: 12,
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
