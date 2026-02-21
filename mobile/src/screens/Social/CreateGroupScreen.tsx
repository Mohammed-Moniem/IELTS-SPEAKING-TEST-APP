import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../context";
import { useFriends, useStudyGroups, useThemedStyles } from "../../hooks";
import { SocialStackParamList } from "../../navigation/SocialNavigator";
import type { ColorTokens } from "../../theme/tokens";

export const CreateGroupScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<SocialStackParamList>>();
  const { createGroup } = useStudyGroups();
  const { friends, loadFriends } = useFriends();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const maxSelectable = 9; // Creator counts as one member

  const availableFriends = useMemo(() => friends || [], [friends]);

  const toggleFriend = (friendId: string) => {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) {
        next.delete(friendId);
        return next;
      }

      if (next.size >= maxSelectable) {
        return next;
      }

      next.add(friendId);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a group name");
      return;
    }

    setCreating(true);
    const newGroup = await createGroup({
      name: name.trim(),
      description: description.trim(),
      settings: {
        isPrivate,
      },
      memberIds: Array.from(selectedFriendIds),
    });

    setCreating(false);

    if (newGroup) {
      Alert.alert("Success", "Study group created!", [
        {
          text: "OK",
          onPress: () =>
            navigation.navigate("GroupDetail", {
              groupId: newGroup._id,
            }),
        },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.label}>Group Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter group name..."
          value={name}
          onChangeText={setName}
          maxLength={50}
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.hint}>{name.length}/50 characters</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What is this group about?"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          maxLength={200}
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.hint}>{description.length}/200 characters</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.label}>Private Group</Text>
            <Text style={styles.settingDescription}>
              Only invited members can join
            </Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ false: colors.borderMuted, true: colors.primary }}
            thumbColor={isPrivate ? colors.primaryOn : colors.surface}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Add Friends</Text>
        <Text style={styles.hint}>
          You can add up to {maxSelectable} friends now (10 members including
          you).
        </Text>
        <View style={styles.friendList}>
          {availableFriends.length === 0 ? (
            <Text style={styles.emptyFriendsText}>
              You need friends to add them to a group. Invite or add friends from
              the Friends tab.
            </Text>
          ) : (
            availableFriends.map((friend) => {
              const friendId = friend.userId || friend._id;
              const isSelected = selectedFriendIds.has(friendId);
              return (
                <TouchableOpacity
                  key={friendId}
                  style={[
                    styles.friendItem,
                    isSelected && styles.friendItemSelected,
                  ]}
                  onPress={() => toggleFriend(friendId)}
                >
                  <View style={styles.friendInfo}>
                    <Ionicons
                      name={isSelected ? "checkbox" : "square-outline"}
                      size={20}
                      color={isSelected ? colors.primary : colors.textMuted}
                    />
                    <Text style={styles.friendName}>
                      {friend.username || friend.friendId?.username ||
                        friendId}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        <Text style={styles.selectionCount}>
          Selected {selectedFriendIds.size}/{maxSelectable}
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color={colors.info} />
        <Text style={styles.infoText}>
          Study groups are a Premium feature. You'll be able to chat with
          members and share progress.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.createButton, creating && styles.createButtonDisabled]}
        onPress={handleCreate}
        disabled={creating}
      >
        <Text style={styles.createButtonText}>
          {creating ? "Creating..." : "Create Study Group"}
        </Text>
      </TouchableOpacity>
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
      paddingBottom: 32,
    },
    section: {
      marginBottom: 24,
    },
    label: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      fontSize: 17,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    textArea: {
      height: 120,
      textAlignVertical: "top",
    },
    hint: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
    },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
    },
    settingInfo: {
      flex: 1,
      marginRight: 16,
    },
    settingDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
    },
    infoBox: {
      flexDirection: "row",
      backgroundColor: colors.infoSoft,
      padding: 16,
      borderRadius: 12,
      marginBottom: 24,
      gap: 12,
    },
    infoText: {
      flex: 1,
      fontSize: 15,
      color: colors.info,
      lineHeight: 20,
    },
    friendList: {
      marginTop: 12,
      gap: 8,
    },
    friendItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    friendItemSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "1A",
    },
    friendInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    friendName: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.textPrimary,
    },
    emptyFriendsText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    selectionCount: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 8,
    },
    createButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
      marginBottom: 32,
    },
    createButtonDisabled: {
      opacity: 0.5,
    },
    createButtonText: {
      color: colors.primaryOn,
      fontSize: 17,
      fontWeight: "600",
    },
  });
