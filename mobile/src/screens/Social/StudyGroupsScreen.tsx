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
import { useTheme } from "../../context";
import { useStudyGroups, useThemedStyles } from "../../hooks";
import type { SocialStackParamList } from "../../navigation/SocialNavigator";
import type { ColorTokens } from "../../theme/tokens";

export const StudyGroupsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<SocialStackParamList>>();
  const {
    groups,
    invites,
    loading,
    loadGroups,
    loadInvites,
    acceptInvite,
    declineInvite,
  } = useStudyGroups();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    Promise.all([loadGroups(), loadInvites()]);
  }, [loadGroups, loadInvites]);

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
          <Text style={styles.inviteGroupName}>
            {item.group?.name || item.groupId?.name || "Study Group"}
          </Text>
          <Text style={styles.inviteFrom}>
            From {item.inviter?.displayName || item.inviterId?.email || "a friend"}
          </Text>
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
        <Ionicons name="people" size={24} color={colors.primary} />
      </View>
      <View style={styles.groupInfo}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupName}>{item.name}</Text>
          {item.isCreator ? (
            <View style={styles.creatorBadge}>
              <Text style={styles.creatorText}>You created this</Text>
            </View>
          ) : item.isAdmin ? (
            <View style={styles.adminBadge}>
              <Text style={styles.adminText}>Admin</Text>
            </View>
          ) : null}
        </View>
        {item.description && (
          <Text style={styles.groupDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.groupMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>
              {(item.memberCount ?? item.memberIds?.length ?? 0)}/
              {item.maxMembers ?? 10} members
            </Text>
          </View>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateGroup}
        >
          <Ionicons name="add-circle" size={20} color={colors.primaryOn} />
          <Text style={styles.createButtonText}>Create Group</Text>
        </TouchableOpacity>
      </View>

      {loading && groups.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
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
            <RefreshControl
              refreshing={loading}
              onRefresh={() => Promise.all([loadGroups(), loadInvites()])}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={colors.textMuted} />
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

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerContainer: {
      backgroundColor: colors.surface,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    createButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      gap: 8,
    },
    createButtonText: {
      color: colors.primaryOn,
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
      backgroundColor: colors.warningSoft,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: colors.warning,
    },
    inviteHeader: {
      marginBottom: 12,
    },
    inviteTitle: {
      fontSize: 13,
      color: colors.warning,
      fontWeight: "600",
      marginBottom: 4,
    },
    inviteGroupName: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    inviteFrom: {
      fontSize: 15,
      color: colors.textSecondary,
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
      backgroundColor: colors.primary,
    },
    acceptButtonText: {
      color: colors.primaryOn,
      fontSize: 15,
      fontWeight: "600",
    },
    declineButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    declineButtonText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    groupCard: {
      flexDirection: "row",
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
    groupIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + "1A",
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
      justifyContent: "space-between",
    },
    groupName: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.textPrimary,
      marginRight: 8,
    },
    adminBadge: {
      backgroundColor: colors.infoSoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    adminText: {
      color: colors.info,
      fontSize: 11,
      fontWeight: "600",
    },
    creatorBadge: {
      backgroundColor: colors.successSoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    creatorText: {
      color: colors.success,
      fontSize: 11,
      fontWeight: "600",
    },
    groupDescription: {
      fontSize: 15,
      color: colors.textSecondary,
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
      color: colors.textSecondary,
    },
    unreadBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      minWidth: 20,
      alignItems: "center",
    },
    unreadText: {
      color: colors.primaryOn,
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
