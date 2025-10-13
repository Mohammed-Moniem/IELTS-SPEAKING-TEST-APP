import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFriends, useSocket } from "../../hooks";
import type { Friend } from "../../services/api/friendService";

export const FriendsListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { friends, loading, loadFriends } = useFriends();
  const { isUserOnline } = useSocket();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);

  useEffect(() => {
    loadFriends();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = friends.filter(
        (friend) =>
          friend.friendId.username
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          friend.friendId.email
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
      );
      setFilteredFriends(filtered);
    } else {
      setFilteredFriends(friends);
    }
  }, [searchQuery, friends]);

  const renderFriend = ({ item }: { item: Friend }) => {
    const isOnline = isUserOnline(item.friendId._id);

    return (
      <TouchableOpacity
        style={styles.friendCard}
        onPress={() =>
          navigation.navigate("UserProfile", { userId: item.friendId._id })
        }
      >
        <View style={styles.friendInfo}>
          <View style={styles.avatarContainer}>
            {item.friendId.avatar ? (
              <Image
                source={{ uri: item.friendId.avatar }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {item.friendId.username?.[0]?.toUpperCase() ||
                    item.friendId.email[0].toUpperCase()}
                </Text>
              </View>
            )}
            {isOnline && <View style={styles.onlineIndicator} />}
          </View>

          <View style={styles.friendDetails}>
            <Text style={styles.friendName}>
              {item.friendId.username || item.friendId.email}
            </Text>
            <Text style={styles.friendMeta}>
              {item.mutualFriends
                ? `${item.mutualFriends} mutual friends`
                : "No mutual friends"}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              navigation.navigate("Chat", {
                recipientId: item.friendId._id,
                recipientName: item.friendId.username || item.friendId.email,
              })
            }
          >
            <Ionicons name="chatbubble" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#8E8E93"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#8E8E93"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}
      </View>

      {/* Actions Row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate("FindFriends")}
        >
          <Ionicons name="person-add" size={20} color="#007AFF" />
          <Text style={styles.headerButtonText}>Find Friends</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate("FriendRequests")}
        >
          <Ionicons name="people" size={20} color="#007AFF" />
          <Text style={styles.headerButtonText}>Requests</Text>
        </TouchableOpacity>
      </View>

      {/* Friends List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : filteredFriends.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color="#C7C7CC" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
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
    color: "#000000",
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
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    color: "#000000",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
    marginTop: 8,
  },
  emptyButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 24,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
  },
  friendCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
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
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
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
    backgroundColor: "#34C759",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  friendDetails: {
    marginLeft: 12,
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
  },
  friendMeta: {
    fontSize: 14,
    color: "#8E8E93",
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
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
});
