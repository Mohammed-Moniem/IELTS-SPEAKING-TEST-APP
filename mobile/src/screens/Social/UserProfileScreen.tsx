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
import { apiClient } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../context";
import { useFriends, useProfile, useSocket, useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
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
  const {
    sendFriendRequest,
    removeFriend,
    friends,
    sentRequests,
    loadSentRequests,
  } = useFriends();
  const { isUserOnline } = useSocket();
  const { user: currentUser } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [profile, setProfile] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
    loadSentRequests(); // Load sent requests to check pending status
  }, [userId]);

  useEffect(() => {
    if (sentRequests.length > 0) {
      console.log("sentRequests data:", JSON.stringify(sentRequests, null, 2));
    }
  }, [sentRequests]);

  const loadProfile = async () => {
    setLoading(true);
    const data = await loadUserProfile(userId);
    if (data) {
      setProfile(data);
      // Fetch real statistics from the API
      try {
        const response = await apiClient.get(`/profile/stats/${userId}`);
        console.log(
          "Statistics response:",
          JSON.stringify(response.data, null, 2)
        );

        if (response.data.success && response.data.data) {
          const stats = response.data.data.statistics;
          setStatistics({
            totalPractices: stats?.totalPracticeSessions || 0,
            totalSimulations: stats?.totalSimulations || 0,
            currentStreak: stats?.currentStreak || 0,
            achievementsUnlocked: stats?.totalAchievements || 0,
          });
        } else {
          // If statistics are hidden, set to null
          setStatistics(null);
        }
      } catch (error) {
        console.log("Error fetching statistics:", error);
        // If error or statistics hidden, don't show them
        setStatistics(null);
      }
    }
    setLoading(false);
  };

  const isFriend = friends.some((f) => f.userId === userId);
  const hasPendingRequest = sentRequests.some((r) => {
    // Backend returns 'receiverId' not 'recipientId'
    const receiverData = (r as any).receiverId;

    // Extract the ID - handle Buffer objects from ObjectId
    let receiverId: string | undefined;
    if (typeof receiverData === "string") {
      receiverId = receiverData;
    } else if (receiverData?._id) {
      // Handle Buffer objects - convert buffer to hex string
      if (receiverData._id.buffer?.data) {
        const bufferData = receiverData._id.buffer.data;
        receiverId = bufferData
          .map((byte: number) => byte.toString(16).padStart(2, "0"))
          .join("");
      } else if (typeof receiverData._id === "string") {
        receiverId = receiverData._id;
      } else {
        receiverId = receiverData._id.toString();
      }
    }

    console.log(
      `Checking pending request: receiverId=${receiverId}, userId=${userId}, match=${
        receiverId === userId
      }`
    );
    return receiverId === userId;
  });
  console.log(
    `UserProfileScreen: isFriend=${isFriend}, hasPendingRequest=${hasPendingRequest}, sentRequests.length=${sentRequests.length}`
  );
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
      conversationId:
        currentUser?._id && userId
          ? [currentUser._id, userId].sort().join("_")
          : undefined,
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
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
                <Ionicons name="chatbubble" size={20} color={colors.primaryOn} />
                <Text style={styles.primaryButtonText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleRemoveFriend}
              >
                <Ionicons name="person-remove" size={20} color={colors.danger} />
              </TouchableOpacity>
            </>
          ) : hasPendingRequest ? (
            <TouchableOpacity
              style={[styles.primaryButton, styles.pendingButton]}
              disabled
            >
              <Ionicons name="time-outline" size={20} color={colors.textMuted} />
              <Text style={styles.pendingButtonText}>Request Pending</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSendRequest}
            >
              <Ionicons name="person-add" size={20} color={colors.primaryOn} />
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
          <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
          <Text style={styles.privacyText}>
            This profile is private. Some information may be hidden.
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    errorText: {
      fontSize: 17,
      color: colors.textSecondary,
    },
    header: {
      backgroundColor: colors.surface,
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
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      color: colors.primaryOn,
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
      backgroundColor: colors.success,
      borderWidth: 3,
      borderColor: colors.surface,
    },
    displayName: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    username: {
      fontSize: 17,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    levelBadge: {
      backgroundColor: colors.info,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 16,
      marginBottom: 20,
    },
    levelText: {
      color: colors.primaryOn,
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
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    primaryButtonText: {
      color: colors.primaryOn,
      fontSize: 17,
      fontWeight: "600",
    },
    pendingButton: {
      backgroundColor: colors.surfaceSubtle,
      opacity: 0.8,
    },
    pendingButtonText: {
      color: colors.textMuted,
      fontSize: 17,
      fontWeight: "600",
    },
    secondaryButton: {
      width: 50,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
    },
    section: {
      backgroundColor: colors.surface,
      marginTop: 12,
      padding: 16,
      borderRadius: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
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
      backgroundColor: colors.surfaceSubtle,
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
    },
    statValue: {
      fontSize: 32,
      fontWeight: "700",
      color: colors.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    achievementCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceSubtle,
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
      color: colors.textPrimary,
      marginBottom: 2,
    },
    achievementDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    achievementPoints: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.info,
    },
    privacyNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.surfaceSubtle,
      padding: 16,
      marginTop: 12,
      borderRadius: 12,
    },
    privacyText: {
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
    },
  });
