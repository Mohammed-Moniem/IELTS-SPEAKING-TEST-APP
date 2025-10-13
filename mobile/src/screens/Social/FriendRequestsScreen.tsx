import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFriends } from "../../hooks";

export const FriendRequestsScreen: React.FC = () => {
  const {
    pendingRequests,
    sentRequests,
    loading,
    loadFriends,
    acceptRequest,
    declineRequest,
    cancelSentRequest,
  } = useFriends();

  useEffect(() => {
    loadFriends();
  }, []);

  const handleAccept = async (requestId: string) => {
    await acceptRequest(requestId);
  };

  const handleDecline = async (requestId: string) => {
    await declineRequest(requestId);
  };

  const handleCancelSent = async (requestId: string) => {
    await cancelSentRequest(requestId);
  };

  const renderPendingRequest = ({ item }: { item: any }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.userInfo}>
          {item.sender.avatar ? (
            <Image source={{ uri: item.sender.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {item.sender.displayName?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
          )}
          <View style={styles.textInfo}>
            <Text style={styles.displayName}>{item.sender.displayName}</Text>
            <Text style={styles.username}>@{item.sender.username}</Text>
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

  if (loading && pendingRequests.length === 0 && sentRequests.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
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
          <Ionicons name="people-outline" size={64} color="#8E8E93" />
          <Text style={styles.emptyTitle}>No friend requests</Text>
          <Text style={styles.emptyDescription}>
            When someone sends you a friend request, it will appear here
          </Text>
        </View>
      )}
    </View>
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
  listContent: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
  },
  sectionCount: {
    fontSize: 15,
    color: "#8E8E93",
  },
  requestCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
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
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "600",
  },
  textInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 2,
  },
  username: {
    fontSize: 15,
    color: "#8E8E93",
    marginBottom: 4,
  },
  mutualFriends: {
    fontSize: 13,
    color: "#007AFF",
  },
  statusText: {
    fontSize: 13,
    color: "#8E8E93",
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
    backgroundColor: "#007AFF",
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  declineButton: {
    backgroundColor: "#F2F2F7",
  },
  declineButtonText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#F2F2F7",
  },
  cancelButtonText: {
    color: "#FF3B30",
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
    color: "#000000",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 22,
  },
});
