import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FriendSkeletonList } from "../../components/skeletons/SocialSkeletons";
import { useTheme } from "../../context";
import { useFriends, useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import type { SocialStackParamList } from "../../navigation/SocialNavigator";

export const FindFriendsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<SocialStackParamList>>();
  const { searchUsers, getFriendSuggestions, sendFriendRequest, loading } =
    useFriends();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

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

  const renderUserItem = ({ item }: { item: any }) => {
    // Extract the actual user ID - handle both populated and unpopulated cases
    const actualUserId =
      typeof item.userId === "object" && item.userId?._id
        ? String(item.userId._id)
        : String(item.userId || item._id);

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() =>
          navigation.navigate("UserProfile", { userId: actualUserId })
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
            onPress={() => handleSendRequest(actualUserId)}
          >
            <Ionicons name="person-add" size={20} color={colors.primary} />
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
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.statusText, styles.friendsText]}>Friends</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const displayData =
    searchQuery.trim().length >= 2 ? searchResults : suggestions;
  const isLoading = searching || loading;
  const isInitialLoading = isLoading && displayData.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={20}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username or email..."
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={colors.textMuted}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isInitialLoading ? (
        <FriendSkeletonList />
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
                color={colors.textMuted}
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

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    searchContainer: {
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceSubtle,
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
      color: colors.textPrimary,
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
    listContent: {
      padding: 16,
      paddingBottom: 24,
    },
    userCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
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
    suggestionReason: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: "italic",
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 4,
    },
    addButtonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: "600",
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 4,
    },
    friendsBadge: {
      backgroundColor: colors.successSoft,
    },
    statusText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    friendsText: {
      color: colors.success,
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
