import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAchievements, useChat, useFriends, useProfile } from "../../hooks";

export const SocialHomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { friends, pendingRequests, loadFriends, loadPendingRequests } =
    useFriends();
  const { unreadCount, loadUnreadCount } = useChat();
  const { unlockedAchievements, loadUnlockedAchievements } = useAchievements();
  const { profile, loadMyProfile } = useProfile();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        loadFriends(),
        loadPendingRequests(),
        loadUnreadCount(),
        loadUnlockedAchievements(),
        loadMyProfile(),
      ]);
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Social</Text>
          <Text style={styles.headerSubtitle}>
            Level {profile?.level || 1} • {profile?.xp || 0} XP
          </Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() =>
            navigation.navigate("UserProfile", { userId: profile?.userId })
          }
        >
          <Ionicons name="person-circle-outline" size={32} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate("FriendsList")}
        >
          <Ionicons name="people" size={24} color="#007AFF" />
          <Text style={styles.statNumber}>{friends.length}</Text>
          <Text style={styles.statLabel}>Friends</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate("Conversations")}
        >
          <Ionicons name="chatbubbles" size={24} color="#34C759" />
          <Text style={styles.statNumber}>{unreadCount}</Text>
          <Text style={styles.statLabel}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate("Achievements")}
        >
          <Ionicons name="trophy" size={24} color="#FFD60A" />
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
            <Ionicons name="person-add" size={28} color="#007AFF" />
            <Text style={styles.actionText}>Find Friends</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("StudyGroups")}
          >
            <Ionicons name="people-circle" size={28} color="#5856D6" />
            <Text style={styles.actionText}>Study Groups</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("Leaderboard")}
          >
            <Ionicons name="podium" size={28} color="#FF9500" />
            <Text style={styles.actionText}>Leaderboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("Referrals")}
          >
            <Ionicons name="gift" size={28} color="#FF2D55" />
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
            <Ionicons name="chatbubbles" size={24} color="#34C759" />
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
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.featureItem}
          onPress={() => navigation.navigate("Achievements")}
        >
          <View style={styles.featureIcon}>
            <Ionicons name="trophy" size={24} color="#FFD60A" />
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Achievements</Text>
            <Text style={styles.featureDescription}>
              Track your progress and earn rewards
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.featureItem}
          onPress={() => navigation.navigate("QRCodeScanner")}
        >
          <View style={styles.featureIcon}>
            <Ionicons name="qr-code" size={24} color="#007AFF" />
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Scan QR Code</Text>
            <Text style={styles.featureDescription}>
              Add friends quickly with QR codes
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#8E8E93",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#000000",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 4,
  },
  profileButton: {
    padding: 4,
  },
  statsRow: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 8,
    color: "#000000",
  },
  statLabel: {
    fontSize: 12,
    color: "#8E8E93",
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
    color: "#000000",
  },
  seeAllText: {
    fontSize: 16,
    color: "#007AFF",
  },
  badge: {
    backgroundColor: "#FF3B30",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  badgeText: {
    color: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
    color: "#000000",
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F2F2F7",
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
    color: "#000000",
  },
  featureDescription: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 2,
  },
  featureBadge: {
    backgroundColor: "#FF3B30",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    marginRight: 8,
  },
  featureBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});
