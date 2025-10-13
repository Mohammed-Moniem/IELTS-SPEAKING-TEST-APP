import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useStudyGroups } from "../../hooks";
import type { SocialStackParamList } from "../../navigation/SocialNavigator";

export const StudyGroupsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<SocialStackParamList>>();
  const { groups, invites, loading, loadGroups, acceptInvite, declineInvite } =
    useStudyGroups();

  useEffect(() => {
    loadGroups();
  }, []);

  const handleCreateGroup = () => {
    navigation.navigate("CreateGroup");
  };

  const handleGroupPress = (groupId: string) => {
    navigation.navigate("GroupDetail", { groupId });
  };

  const handleAcceptInvite = async (inviteId: string) => {
    const success = await acceptInvite(inviteId);
    if (success) {
      Alert.alert("Success", "You joined the group!");
      loadGroups();
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    await declineInvite(inviteId);
    loadGroups();
  };

  const renderInvite = ({ item }: { item: any }) => (
    <View style={styles.inviteCard}>
      <View style={styles.inviteHeader}>
        <View>
          <Text style={styles.inviteTitle}>Group Invitation</Text>
          <Text style={styles.inviteGroupName}>{item.group.name}</Text>
          <Text style={styles.inviteFrom}>From {item.inviter.displayName}</Text>
        </View>
      </View>
      <View style={styles.inviteActions}>
        <TouchableOpacity
          style={[styles.inviteButton, styles.acceptButton]}
          onPress={() => handleAcceptInvite(item._id)}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.inviteButton, styles.declineButton]}
          onPress={() => handleDeclineInvite(item._id)}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderGroup = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => handleGroupPress(item._id)}
    >
      <View style={styles.groupIcon}>
        <Ionicons name="people" size={24} color="#007AFF" />
      </View>
      <View style={styles.groupInfo}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupName}>{item.name}</Text>
          {item.isPremium && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumText}>Premium</Text>
            </View>
          )}
        </View>
        {item.description && (
          <Text style={styles.groupDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.groupMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={14} color="#8E8E93" />
            <Text style={styles.metaText}>{item.memberCount} members</Text>
          </View>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateGroup}
        >
          <Ionicons name="add-circle" size={20} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Create Group</Text>
        </TouchableOpacity>
      </View>

      {loading && groups.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={[
            ...invites.map((i) => ({ ...i, type: "invite" })),
            ...groups.map((g) => ({ ...g, type: "group" })),
          ]}
          renderItem={({ item }) =>
            item.type === "invite"
              ? renderInvite({ item })
              : renderGroup({ item })
          }
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadGroups} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#8E8E93" />
              <Text style={styles.emptyTitle}>No study groups yet</Text>
              <Text style={styles.emptyDescription}>
                Create a group or ask friends to invite you
              </Text>
            </View>
          }
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
  headerContainer: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
  },
  inviteCard: {
    backgroundColor: "#FFF3CD",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#FF9500",
  },
  inviteHeader: {
    marginBottom: 12,
  },
  inviteTitle: {
    fontSize: 13,
    color: "#856404",
    fontWeight: "600",
    marginBottom: 4,
  },
  inviteGroupName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 4,
  },
  inviteFrom: {
    fontSize: 15,
    color: "#8E8E93",
  },
  inviteActions: {
    flexDirection: "row",
    gap: 12,
  },
  inviteButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  declineButtonText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "600",
  },
  groupCard: {
    flexDirection: "row",
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
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E8F4FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  groupName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    marginRight: 8,
  },
  premiumBadge: {
    backgroundColor: "#5856D6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  premiumText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  groupDescription: {
    fontSize: 15,
    color: "#8E8E93",
    marginBottom: 8,
  },
  groupMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: "#8E8E93",
  },
  unreadBadge: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: "center",
  },
  unreadText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
    paddingHorizontal: 32,
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
