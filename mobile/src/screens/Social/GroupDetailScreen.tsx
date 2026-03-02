import { Ionicons } from "@expo/vector-icons";
import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { useFriends, useStudyGroups } from "../../hooks";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { SocialStackParamList } from "../../navigation/SocialNavigator";
import type { GroupMember, StudyGroup } from "../../services/api/groupService";
import type { ColorTokens } from "../../theme/tokens";
import { logger } from "../../utils/logger";

type GroupDetailScreenRouteProp = RouteProp<
  SocialStackParamList,
  "GroupDetail"
>;
type GroupDetailScreenNavigationProp = NavigationProp<SocialStackParamList>;

export const GroupDetailScreen: React.FC = () => {
  const route = useRoute<GroupDetailScreenRouteProp>();
  const navigation = useNavigation<GroupDetailScreenNavigationProp>();
  const { groupId } = route.params;
  const { user } = useAuth();
  const {
    getGroup,
    getMembers,
    removeMember,
    leaveGroup,
    deleteGroup,
    addMember,
    loadGroups,
  } = useStudyGroups();
  const { friends, loadFriends } = useFriends();

  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const currentUserId = user?._id;

  const refreshMembers = useCallback(async () => {
    const fetchedMembers = await getMembers(groupId);
    setMembers(fetchedMembers);
  }, [getMembers, groupId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedGroup] = await Promise.all([
        getGroup(groupId),
        loadFriends(),
      ]);
      setGroup(fetchedGroup ?? null);
      await refreshMembers();
    } catch (error) {
      logger.warn("Failed to load group", error);
    } finally {
      setLoading(false);
    }
  }, [getGroup, groupId, loadFriends, refreshMembers]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const memberCount = useMemo(() => {
    if (typeof group?.memberCount === "number") {
      return group.memberCount;
    }
    if (Array.isArray(group?.memberIds)) {
      return group.memberIds.length;
    }
    return members.length;
  }, [group, members]);

  const availableFriends = useMemo(() => {
    if (!group) {
      return [];
    }
    const existing = new Set<string>((group.memberIds || []).map(String));
    return (friends || []).filter((friend) => {
      const friendId = friend.userId || friend._id;
      return friendId && !existing.has(friendId) && friendId !== currentUserId;
    });
  }, [currentUserId, friends, group]);

  const isAdmin = group?.isAdmin;
  const isCreator = group?.isCreator;
  const maxMembers = group?.maxMembers ?? 10;
  const groupIsFull = memberCount >= maxMembers;

  const handleAddMember = async (friendId: string, displayName?: string) => {
    if (!group || !friendId) {
      return;
    }

    if (groupIsFull) {
      Alert.alert("Group is full", "Remove someone before adding new members.");
      return;
    }

    setBusy(true);
    const updated = await addMember(groupId, friendId);
    setBusy(false);

    if (updated) {
      setGroup(updated);
      await Promise.all([refreshMembers(), loadGroups()]);
      Alert.alert("Success", `${displayName || "Friend"} added to the group.`);
    }
  };

  const handleRemoveMember = (member: GroupMember) => {
    Alert.alert(
      "Remove member",
      `Remove ${
        member.displayName || member.username || member.email || "this member"
      } from the group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            const success = await removeMember(groupId, member.userId);
            setBusy(false);
            if (success) {
              await Promise.all([refreshMembers(), loadGroups()]);
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert("Leave group", "Are you sure you want to leave this group?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          if (!currentUserId) return;
          setBusy(true);
          const success = await leaveGroup(groupId);
          setBusy(false);
          if (success) {
            await loadGroups();
            navigation.goBack();
          }
        },
      },
    ]);
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      "Delete group",
      "This will remove the study group for all members. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            const success = await deleteGroup(groupId);
            setBusy(false);
            if (success) {
              await loadGroups();
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const handleOpenChat = () => {
    navigation.navigate("GroupChat", {
      groupId: group?._id || groupId,
      groupName: group?.name || "Group Chat",
    });
  };
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (loading || !group) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Text style={styles.groupTitle}>{group.name}</Text>
          <View style={styles.memberCountBadge}>
            <Ionicons name="people" size={16} color={colors.primary} />
            <Text style={styles.memberCountText}>
              {memberCount}/{maxMembers}
            </Text>
          </View>
        </View>
        {group.description ? (
          <Text style={styles.groupDescription}>{group.description}</Text>
        ) : null}
        <View style={styles.roleBadges}>
          {group.isCreator ? (
            <View style={styles.creatorBadge}>
              <Text style={styles.creatorText}>You are the creator</Text>
            </View>
          ) : group.isAdmin ? (
            <View style={styles.adminBadge}>
              <Text style={styles.adminText}>You are an admin</Text>
            </View>
          ) : (
            <View style={styles.memberBadge}>
              <Text style={styles.memberText}>Member</Text>
            </View>
          )}
          {group.settings.isPrivate && (
            <View style={styles.privateBadge}>
              <Text style={styles.privateText}>Private</Text>
            </View>
          )}
        </View>
      </View>

      {/* Open Chat Button */}
      <TouchableOpacity
        style={styles.chatButton}
        onPress={handleOpenChat}
        activeOpacity={0.7}
      >
        <Ionicons name="chatbubbles" size={24} color={colors.primaryOn} />
        <Text style={styles.chatButtonText}>Open Group Chat</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.primaryOn} />
      </TouchableOpacity>

      {isAdmin ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Add friends</Text>
            <Text style={styles.sectionSubtitle}>
              {groupIsFull
                ? "Group is full"
                : `${availableFriends.length} friend${
                    availableFriends.length === 1 ? "" : "s"
                  } available`}
            </Text>
          </View>
          {groupIsFull ? (
            <Text style={styles.infoText}>
              This group already has the maximum number of members.
            </Text>
          ) : availableFriends.length === 0 ? (
            <Text style={styles.infoText}>
              None of your friends are available to add right now. Add more
              friends first.
            </Text>
          ) : (
            availableFriends.map((friend) => {
              const friendId = friend.userId || friend._id;
              const displayName =
                friend.username ||
                friend.friendId?.username ||
                friend.friendId?.email ||
                friendId;
              return (
                <View style={styles.friendRow} key={friendId}>
                  <View style={styles.friendInfo}>
                    <Ionicons name="person-circle" size={24} color={colors.primary} />
                    <View>
                      <Text style={styles.friendName}>{displayName}</Text>
                      {friend.friendId?.email ? (
                        <Text style={styles.friendEmail}>
                          {friend.friendId.email}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => handleAddMember(friendId, displayName)}
                    disabled={busy}
                  >
                    <Ionicons name="add" size={18} color={colors.primary} />
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Members</Text>
        {members.map((member) => {
          const showRemove =
            isAdmin && member.userId !== currentUserId && !member.isCreator;

          return (
            <View style={styles.memberRow} key={member.userId}>
              <View style={styles.memberInfo}>
                <Ionicons
                  name="person-circle"
                  size={28}
                  color={colors.textSecondary}
                />
                <View style={styles.memberTextContainer}>
                  <Text style={styles.memberName}>
                    {member.displayName ||
                      member.username ||
                      member.email ||
                      "Member"}
                  </Text>
                  <View style={styles.memberBadges}>
                    {member.isCreator ? (
                      <View style={styles.creatorBadge}>
                        <Text style={styles.creatorText}>Creator</Text>
                      </View>
                    ) : member.isAdmin ? (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminText}>Admin</Text>
                      </View>
                    ) : null}
                    {member.userId === currentUserId ? (
                      <View style={styles.memberBadge}>
                        <Text style={styles.memberText}>You</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
              {showRemove ? (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveMember(member)}
                  disabled={busy}
                >
                  <Ionicons name="remove-circle" size={20} color={colors.danger} />
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        {isCreator ? (
          <TouchableOpacity
            style={[styles.dangerButton, busy && styles.disabledButton]}
            onPress={handleDeleteGroup}
            disabled={busy}
          >
            <Ionicons name="trash" size={20} color={colors.primaryOn} />
            <Text style={styles.dangerButtonText}>Delete group</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.dangerButton, busy && styles.disabledButton]}
            onPress={handleLeaveGroup}
            disabled={busy}
          >
            <Ionicons name="log-out" size={20} color={colors.primaryOn} />
            <Text style={styles.dangerButtonText}>Leave group</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
      paddingBottom: 48,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    headerCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    groupTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    groupDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    memberCountBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.infoSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    memberCountText: {
      fontSize: 14,
      color: colors.info,
      fontWeight: "600",
    },
    chatButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 16,
      marginBottom: 24,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    chatButtonText: {
      color: colors.primaryOn,
      fontSize: 18,
      fontWeight: "700",
    },
    roleBadges: {
      flexDirection: "row",
      gap: 8,
      marginTop: 16,
      flexWrap: "wrap",
    },
    creatorBadge: {
      backgroundColor: colors.successSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    creatorText: {
      color: colors.success,
      fontSize: 12,
      fontWeight: "600",
    },
    adminBadge: {
      backgroundColor: colors.infoSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    adminText: {
      color: colors.info,
      fontSize: 12,
      fontWeight: "600",
    },
    memberBadge: {
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    memberText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },
    privateBadge: {
      backgroundColor: colors.warningSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    privateText: {
      color: colors.warning,
      fontSize: 12,
      fontWeight: "600",
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    infoText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    friendRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surface,
      padding: 12,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    friendInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    friendName: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    friendEmail: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderColor: colors.primary,
      borderWidth: 1,
    },
    addButtonText: {
      color: colors.primary,
      fontWeight: "600",
    },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      padding: 12,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    memberInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    memberTextContainer: {
      flex: 1,
    },
    memberName: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    memberBadges: {
      flexDirection: "row",
      gap: 6,
      marginTop: 6,
    },
    removeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    removeButtonText: {
      color: colors.danger,
      fontWeight: "600",
    },
    dangerButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.danger,
      paddingVertical: 14,
      borderRadius: 12,
    },
    disabledButton: {
      opacity: 0.6,
    },
    dangerButtonText: {
      color: colors.dangerOn,
      fontSize: 16,
      fontWeight: "700",
    },
  });
