import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFriends, useProfile, useSocket } from "../../hooks";
import type { SocialStackParamList } from "../../navigation/SocialNavigator";

type UserProfileScreenRouteProp = RouteProp<
  SocialStackParamList,
  "UserProfile"
>;

export const UserProfileScreen: React.FC = () => {
  const route = useRoute<UserProfileScreenRouteProp>();
  const navigation =
    useNavigation<NativeStackNavigationProp<SocialStackParamList>>();
  const { userId } = route.params;

  const { loadUserProfile } = useProfile();
  const { sendFriendRequest, removeFriend, friends } = useFriends();
  const { isUserOnline } = useSocket();

  const [profile, setProfile] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    const data = await loadUserProfile(userId);
    if (data) {
      setProfile(data);
      // Statistics would be loaded separately in a real app
      setStatistics({
        totalPractices: 0,
        totalSimulations: 0,
        currentStreak: 0,
        achievementsUnlocked: 0,
      });
    }
    setLoading(false);
  };

  const isFriend = friends.some((f) => f.userId === userId);
  const isOnline = isUserOnline(userId);

  const handleSendRequest = async () => {
    const success = await sendFriendRequest(userId);
    if (success) {
      Alert.alert("Success", "Friend request sent!");
    }
  };

  const handleRemoveFriend = () => {
    Alert.alert(
      "Remove Friend",
      "Are you sure you want to remove this friend?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await removeFriend(userId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleStartChat = () => {
    navigation.navigate("Chat", {
      recipientId: userId,
      recipientName: profile.displayName,
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Profile not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {profile.displayName?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
          )}
          {isOnline && <View style={styles.onlineIndicator} />}
        </View>

        <Text style={styles.displayName}>{profile.displayName}</Text>
        <Text style={styles.username}>@{profile.username}</Text>

        {profile.level && (
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Level {profile.level}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {isFriend ? (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleStartChat}
              >
                <Ionicons name="chatbubble" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleRemoveFriend}
              >
                <Ionicons name="person-remove" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSendRequest}
            >
              <Ionicons name="person-add" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Add Friend</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Statistics Section */}
      {statistics && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {statistics.totalPractices || 0}
              </Text>
              <Text style={styles.statLabel}>Practices</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {statistics.totalSimulations || 0}
              </Text>
              <Text style={styles.statLabel}>Simulations</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {statistics.currentStreak || 0}
              </Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {statistics.achievementsUnlocked || 0}
              </Text>
              <Text style={styles.statLabel}>Achievements</Text>
            </View>
          </View>
        </View>
      )}

      {/* Recent Achievements */}
      {profile.recentAchievements && profile.recentAchievements.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Achievements</Text>
          {profile.recentAchievements.map((achievement: any, index: number) => (
            <View key={index} style={styles.achievementCard}>
              <Text style={styles.achievementIcon}>{achievement.icon}</Text>
              <View style={styles.achievementInfo}>
                <Text style={styles.achievementName}>{achievement.name}</Text>
                <Text style={styles.achievementDescription}>
                  {achievement.description}
                </Text>
              </View>
              <Text style={styles.achievementPoints}>
                +{achievement.points}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Privacy Notice */}
      {!profile.isPublic && (
        <View style={styles.privacyNotice}>
          <Ionicons name="lock-closed" size={16} color="#8E8E93" />
          <Text style={styles.privacyText}>
            This profile is private. Some information may be hidden.
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
  },
  errorText: {
    fontSize: 17,
    color: "#8E8E93",
  },
  header: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "600",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#34C759",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  displayName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 4,
  },
  username: {
    fontSize: 17,
    color: "#8E8E93",
    marginBottom: 12,
  },
  levelBadge: {
    backgroundColor: "#5856D6",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
  },
  levelText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  secondaryButton: {
    width: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
  },
  section: {
    backgroundColor: "#FFFFFF",
    marginTop: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#F2F2F7",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  statValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#007AFF",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: "#8E8E93",
  },
  achievementCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  achievementIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 2,
  },
  achievementDescription: {
    fontSize: 13,
    color: "#8E8E93",
  },
  achievementPoints: {
    fontSize: 17,
    fontWeight: "700",
    color: "#5856D6",
  },
  privacyNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F2F2F7",
    padding: 16,
    marginTop: 12,
  },
  privacyText: {
    fontSize: 13,
    color: "#8E8E93",
    flex: 1,
  },
});
