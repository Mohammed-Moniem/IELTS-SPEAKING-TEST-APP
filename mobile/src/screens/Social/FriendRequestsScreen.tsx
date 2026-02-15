import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FriendSkeletonList } from "../../components/skeletons/SocialSkeletons";
import { useTheme } from "../../context";
import { useFriends, useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";

export const FriendRequestsScreen: React.FC = () => {
  const {
    pendingRequests,
    sentRequests,
    loading,
    loadFriends,
    loadPendingRequests,
    loadSentRequests,
    acceptRequest,
    declineRequest,
    cancelSentRequest,
  } = useFriends();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    loadFriends();
    loadPendingRequests();
    loadSentRequests();
  }, []);

  // Helper to extract ID from Buffer objects
  const extractId = (idField: any): string => {
    if (typeof idField === "string") {
      return idField;
    }
    if (idField?.buffer?.data) {
      return idField.buffer.data
        .map((byte: number) => byte.toString(16).padStart(2, "0"))
        .join("");
    }
    return idField?.toString() || "";
  };

  useEffect(() => {
    if (pendingRequests.length > 0) {
      console.log(
        "Pending requests:",
        JSON.stringify(pendingRequests, null, 2)
      );
    }
  }, [pendingRequests]);

  const handleAccept = async (requestId: any) => {
    const id = extractId(requestId);
    console.log("Accepting request ID:", id);
    await acceptRequest(id);
    // Reload requests after accepting
    await loadPendingRequests();
    await loadFriends();
  };

  const handleDecline = async (requestId: any) => {
    const id = extractId(requestId);
    console.log("Declining request ID:", id);
    await declineRequest(id);
    // Reload requests after declining
    await loadPendingRequests();
  };

  const handleCancelSent = async (requestId: any) => {
    const id = extractId(requestId);
    await cancelSentRequest(id);
    // Reload sent requests after canceling
    await loadSentRequests();
  };

  const renderPendingRequest = ({ item }: { item: any }) => {
    // Backend returns senderId not sender, and uses Buffer objects for ObjectIds
    const sender = item.senderId || item.sender;

    // Extract display name from firstName/lastName or use email
    const displayName =
      sender.firstName && sender.lastName
        ? `${sender.firstName} ${sender.lastName}`
        : sender.email;

    // Extract first letter for avatar
    const avatarLetter = (
      sender.firstName?.charAt(0) ||
      sender.email?.charAt(0) ||
      "U"
    ).toUpperCase();

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.userInfo}>
            {sender.avatar ? (
              <Image source={{ uri: sender.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>{avatarLetter}</Text>
              </View>
            )}
            <View style={styles.textInfo}>
              <Text style={styles.displayName}>{displayName}</Text>
              <Text style={styles.username}>{sender.email}</Text>
              {item.mutualFriends > 0 && (
                <Text style={styles.mutualFriends}>
                  {item.mutualFriends} mutual friend
                  {item.mutualFriends !== 1 ? "s" : ""}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            onPress={() => handleAccept(item._id)}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.declineButton]}
            onPress={() => handleDecline(item._id)}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSentRequest = ({ item }: { item: any }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.userInfo}>
          {item.recipient.avatar ? (
            <Image
              source={{ uri: item.recipient.avatar }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {item.recipient.displayName?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
          )}
          <View style={styles.textInfo}>
            <Text style={styles.displayName}>{item.recipient.displayName}</Text>
            <Text style={styles.username}>@{item.recipient.username}</Text>
            <Text style={styles.statusText}>Request sent</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.cancelButton]}
        onPress={() => handleCancelSent(item._id)}
      >
        <Text style={styles.cancelButtonText}>Cancel Request</Text>
      </TouchableOpacity>
    </View>
  );

  const isInitialLoading =
    loading && pendingRequests.length === 0 && sentRequests.length === 0;

  if (isInitialLoading) {
    return (
      <View style={styles.container}>
        <FriendSkeletonList />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {pendingRequests.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Friend Requests</Text>
            <Text style={styles.sectionCount}>{pendingRequests.length}</Text>
          </View>
          <FlatList
            data={pendingRequests}
            renderItem={renderPendingRequest}
            keyExtractor={(item) => item._id}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={loadFriends} />
            }
            contentContainerStyle={styles.listContent}
          />
        </>
      )}

      {sentRequests.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sent Requests</Text>
            <Text style={styles.sectionCount}>{sentRequests.length}</Text>
          </View>
          <FlatList
            data={sentRequests}
            renderItem={renderSentRequest}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
          />
        </>
      )}

      {pendingRequests.length === 0 && sentRequests.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No friend requests</Text>
          <Text style={styles.emptyDescription}>
            When someone sends you a friend request, it will appear here
          </Text>
        </View>
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
    listContent: {
      padding: 16,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    sectionCount: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    requestCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    requestHeader: {
      marginBottom: 12,
    },
    userInfo: {
      flexDirection: "row",
      alignItems: "center",
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      marginRight: 12,
    },
    avatarPlaceholder: {
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      color: colors.primaryOn,
      fontSize: 24,
      fontWeight: "600",
    },
    textInfo: {
      flex: 1,
    },
    displayName: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    username: {
      fontSize: 15,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    mutualFriends: {
      fontSize: 13,
      color: colors.primary,
    },
    statusText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: "italic",
    },
    actionButtons: {
      flexDirection: "row",
      gap: 12,
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    acceptButton: {
      backgroundColor: colors.primary,
    },
    acceptButtonText: {
      color: colors.primaryOn,
      fontSize: 15,
      fontWeight: "600",
    },
    declineButton: {
      backgroundColor: colors.surfaceSubtle,
    },
    declineButtonText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    cancelButton: {
      backgroundColor: colors.surfaceSubtle,
    },
    cancelButtonText: {
      color: colors.danger,
      fontSize: 15,
      fontWeight: "600",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: "600",
      color: colors.textPrimary,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
  });
