import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { FriendSkeletonList } from "../../components/skeletons/SocialSkeletons";
import { useTheme } from "../../context";
import { useFriends, useSocket, useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import type { Friend } from "../../services/api/friendService";

export const FriendsListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { friends, loading, loadFriends } = useFriends();
  const { isUserOnline } = useSocket();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Helper to extract ID from Buffer objects
  const extractId = (idField: any): string => {
    if (!idField) return "";
    if (typeof idField === "string") return idField;
    if (idField.buffer?.data) {
      return idField.buffer.data
        .map((byte: number) => byte.toString(16).padStart(2, "0"))
        .join("");
    }
    if (idField._id) return extractId(idField._id);
    return idField.toString();
  };

  const resolveUserId = (friendEntry: any): string => {
    if (!friendEntry) return "";

    const candidates = [
      friendEntry.userId,
      friendEntry.friendId?.userId,
      friendEntry.friendId?._id,
      friendEntry.friendId,
      friendEntry._id,
    ];

    for (const candidate of candidates) {
      const resolved = extractId(candidate);
      if (resolved) {
        return resolved;
      }
    }

    return "";
  };

  useEffect(() => {
    loadFriends();
  }, []);

  useEffect(() => {
    if (friends.length > 0) {
      console.log("Friends data:", JSON.stringify(friends, null, 2));
    }
  }, [friends]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = friends.filter((friend: any) => {
        // Handle both nested friendId and flat structure
        const username = friend.friendId?.username || friend.username;
        const email = friend.friendId?.email || friend.userId;

        return (
          username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          email?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
      setFilteredFriends(filtered);
    } else {
      setFilteredFriends(friends);
    }
  }, [searchQuery, friends]);

  const renderFriend = ({ item }: { item: any }) => {
    // Backend returns flat structure: { userId, username, avatar, bio, lastActive }
    // NOT nested as { friendId: { ... } }
    const friendData = item.friendId || item; // Support both structures

    const actualUserId = resolveUserId(friendData);
    const username = friendData.username || "Unknown User";
    const email = friendData.email || "";
    const avatar = friendData.avatar;
    const isOnline = isUserOnline(actualUserId);

    return (
      <TouchableOpacity
        style={styles.friendCard}
        onPress={() =>
          navigation.navigate("UserProfile", { userId: actualUserId })
        }
      >
        <View style={styles.friendInfo}>
          <View style={styles.avatarContainer}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {isOnline && <View style={styles.onlineIndicator} />}
          </View>

          <View style={styles.friendDetails}>
            <Text style={styles.friendName}>{username}</Text>
            <Text style={styles.friendMeta}>{email || "No email"}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              navigation.navigate("Chat", {
                recipientId: actualUserId,
                recipientName: username,
                conversationId:
                  user?._id && actualUserId
                    ? [user._id, actualUserId].sort().join("_")
                    : undefined,
              })
            }
          >
            <Ionicons name="chatbubble" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const isInitialLoading = loading && friends.length === 0;

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color={colors.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.textMuted}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Actions Row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate("FindFriends")}
        >
          <Ionicons name="person-add" size={20} color={colors.primary} />
          <Text style={styles.headerButtonText}>Find Friends</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate("FriendRequests")}
        >
          <Ionicons name="people" size={20} color={colors.primary} />
          <Text style={styles.headerButtonText}>Requests</Text>
        </TouchableOpacity>
      </View>

      {/* Friends List */}
      {isInitialLoading ? (
        <FriendSkeletonList />
      ) : filteredFriends.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>
            {searchQuery ? "No friends found" : "No friends yet"}
          </Text>
          <Text style={styles.emptyText}>
            {searchQuery
              ? "Try a different search term"
              : "Start adding friends to see them here"}
          </Text>
          {!searchQuery && (
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate("FindFriends")}
            >
              <Text style={styles.emptyButtonText}>Find Friends</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredFriends}
          renderItem={renderFriend}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          onRefresh={loadFriends}
          refreshing={loading}
        />
      )}
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      margin: 16,
      paddingHorizontal: 12,
      borderRadius: 10,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      height: 40,
      fontSize: 16,
      color: colors.textPrimary,
    },
    actionsRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      gap: 12,
      marginBottom: 16,
    },
    headerButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      gap: 8,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    headerButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.primary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: "600",
      color: colors.textPrimary,
      marginTop: 16,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 8,
    },
    emptyButton: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 10,
      marginTop: 24,
    },
    emptyButtonText: {
      color: colors.primaryOn,
      fontSize: 16,
      fontWeight: "600",
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    friendCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    friendInfo: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    avatarContainer: {
      position: "relative",
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
    },
    avatarPlaceholder: {
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      color: colors.primaryOn,
      fontSize: 20,
      fontWeight: "600",
    },
    onlineIndicator: {
      position: "absolute",
      bottom: 2,
      right: 2,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    friendDetails: {
      marginLeft: 12,
      flex: 1,
    },
    friendName: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    friendMeta: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    actions: {
      flexDirection: "row",
      gap: 8,
    },
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceSubtle,
      alignItems: "center",
      justifyContent: "center",
    },
  });
