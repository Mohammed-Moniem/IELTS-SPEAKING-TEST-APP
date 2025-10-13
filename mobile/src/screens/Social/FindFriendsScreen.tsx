import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFriends } from "../../hooks";
import type { SocialStackParamList } from "../../navigation/SocialNavigator";

export const FindFriendsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<SocialStackParamList>>();
  const { searchUsers, getFriendSuggestions, sendFriendRequest, loading } =
    useFriends();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    const data = await getFriendSuggestions();
    setSuggestions(data);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const results = await searchUsers(query);
    setSearchResults(results);
    setSearching(false);
  };

  const handleSendRequest = async (userId: string) => {
    const success = await sendFriendRequest(userId);
    if (success) {
      Alert.alert("Success", "Friend request sent!");
      // Refresh search and suggestions
      if (searchQuery) {
        handleSearch(searchQuery);
      }
      loadSuggestions();
    }
  };

  const renderUserItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() =>
        navigation.navigate("UserProfile", { userId: item.userId || item._id })
      }
    >
      <View style={styles.userInfo}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {item.displayName?.charAt(0).toUpperCase() || "U"}
            </Text>
          </View>
        )}
        <View style={styles.textInfo}>
          <Text style={styles.displayName}>{item.displayName}</Text>
          <Text style={styles.username}>@{item.username}</Text>
          {item.mutualFriends > 0 && (
            <Text style={styles.mutualFriends}>
              {item.mutualFriends} mutual friend
              {item.mutualFriends !== 1 ? "s" : ""}
            </Text>
          )}
          {item.reason && (
            <Text style={styles.suggestionReason}>{item.reason}</Text>
          )}
        </View>
      </View>

      {item.friendshipStatus === "none" && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleSendRequest(item.userId || item._id)}
        >
          <Ionicons name="person-add" size={20} color="#007AFF" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      )}
      {item.friendshipStatus === "pending" && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Pending</Text>
        </View>
      )}
      {item.friendshipStatus === "friends" && (
        <View style={[styles.statusBadge, styles.friendsBadge]}>
          <Ionicons name="checkmark-circle" size={16} color="#34C759" />
          <Text style={[styles.statusText, styles.friendsText]}>Friends</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const displayData =
    searchQuery.trim().length >= 2 ? searchResults : suggestions;
  const isLoading = searching || loading;

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={20}
            color="#8E8E93"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username or email..."
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={20} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <>
          {displayData.length > 0 ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {searchQuery.trim().length >= 2
                    ? "Search Results"
                    : "Suggested Friends"}
                </Text>
                <Text style={styles.sectionCount}>{displayData.length}</Text>
              </View>
              <FlatList
                data={displayData}
                renderItem={renderUserItem}
                keyExtractor={(item) => item.userId || item._id}
                contentContainerStyle={styles.listContent}
              />
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons
                name={searchQuery ? "search" : "people-outline"}
                size={64}
                color="#8E8E93"
              />
              <Text style={styles.emptyTitle}>
                {searchQuery ? "No results found" : "No suggestions"}
              </Text>
              <Text style={styles.emptyDescription}>
                {searchQuery
                  ? "Try searching with a different username or email"
                  : "Complete your profile to get friend suggestions based on your interests"}
              </Text>
            </View>
          )}
        </>
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
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#000000",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  listContent: {
    padding: 16,
  },
  userCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
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
  suggestionReason: {
    fontSize: 13,
    color: "#8E8E93",
    fontStyle: "italic",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F4FF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addButtonText: {
    color: "#007AFF",
    fontSize: 15,
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  friendsBadge: {
    backgroundColor: "#E8F5E9",
  },
  statusText: {
    fontSize: 13,
    color: "#8E8E93",
    fontWeight: "600",
  },
  friendsText: {
    color: "#34C759",
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
