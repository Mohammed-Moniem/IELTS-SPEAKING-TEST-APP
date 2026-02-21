import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { OnlineStatusBadge } from "../../components/chat/OnlineStatusBadge";
import { ConversationSkeletonList } from "../../components/skeletons/SocialSkeletons";
import { useTheme } from "../../context";
import { useChat, useSocket, useThemedStyles } from "../../hooks";
import type { Conversation } from "../../services/api/chatService";
import type { ColorTokens } from "../../theme/tokens";

export const ConversationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { conversations, unreadCount, loading, loadConversations } = useChat();
  const { isUserOnline } = useSocket();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    loadConversations();
  }, []);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const getOtherParticipant = (conversation: Conversation) => {
    if (conversation.isGroupChat) {
      return null;
    }
    return (
      conversation.participants.find((participant) =>
        user?._id ? participant._id !== user._id : true
      ) ||
      conversation.participants[0] ||
      null
    );
  };

  const getConversationName = (conversation: Conversation) => {
    if (conversation.isGroupChat) {
      return conversation.groupName || "Group Chat";
    }
    const otherParticipant = getOtherParticipant(conversation);
    return otherParticipant?.username || otherParticipant?.email || "Unknown";
  };

  const isConversationOnline = (conversation: Conversation) => {
    if (conversation.isGroupChat) return false;
    const otherParticipant = getOtherParticipant(conversation);
    return otherParticipant ? isUserOnline(otherParticipant._id) : false;
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const name = getConversationName(item);
    const otherParticipant = getOtherParticipant(item);
    const avatar = item.isGroupChat ? null : otherParticipant?.avatar;
    const isOnline = isConversationOnline(item);
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={styles.conversationCard}
        onPress={() =>
          navigation.navigate("Chat", {
            conversationId: item.conversationId,
            recipientName: name,
            isGroupChat: item.isGroupChat,
            recipientId: otherParticipant?._id,
          })
        }
      >
        <View style={styles.avatarContainer}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons
                name={item.isGroupChat ? "people" : "person"}
                size={24}
                color={colors.primaryOn}
              />
            </View>
          )}
          {!item.isGroupChat && otherParticipant && (
            <OnlineStatusBadge
              userId={otherParticipant._id}
              size="small"
              style={styles.onlineStatusBadge}
            />
          )}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text
              style={[styles.conversationName, hasUnread && styles.unreadName]}
            >
              {name}
            </Text>
            {item.lastMessage && (
              <Text style={styles.timestamp}>
                {formatTimestamp(item.lastMessage.timestamp)}
              </Text>
            )}
          </View>

          <View style={styles.messageRow}>
            {item.lastMessage && (
              <Text
                style={[styles.lastMessage, hasUnread && styles.unreadMessage]}
                numberOfLines={1}
              >
                {item.lastMessage.preview}
              </Text>
            )}
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unreadCount > 99 ? "99+" : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const isInitialLoading = loading && conversations.length === 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        {unreadCount > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {isInitialLoading ? (
        <ConversationSkeletonList />
      ) : conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="chatbubbles-outline"
            size={64}
            color={colors.textMuted}
          />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            Start chatting with your friends to see conversations here
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate("FriendsList")}
          >
            <Text style={styles.emptyButtonText}>Go to Friends</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          onRefresh={loadConversations}
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 16,
      backgroundColor: colors.surface,
    },
    headerTitle: {
      fontSize: 34,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    headerBadge: {
      backgroundColor: colors.danger,
      borderRadius: 12,
      minWidth: 24,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
      marginLeft: 12,
    },
    headerBadgeText: {
      color: colors.dangerOn,
      fontSize: 12,
      fontWeight: "600",
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
      paddingTop: 8,
    },
    conversationCard: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderMuted,
    },
    avatarContainer: {
      position: "relative",
      marginRight: 12,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    avatarPlaceholder: {
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
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
    onlineStatusBadge: {
      position: "absolute",
      bottom: 2,
      right: 2,
    },
    conversationContent: {
      flex: 1,
      justifyContent: "center",
    },
    conversationHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    conversationName: {
      fontSize: 17,
      fontWeight: "400",
      color: colors.textPrimary,
      flex: 1,
    },
    unreadName: {
      fontWeight: "600",
    },
    timestamp: {
      fontSize: 14,
      color: colors.textSecondary,
      marginLeft: 8,
    },
    messageRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    lastMessage: {
      fontSize: 15,
      color: colors.textSecondary,
      flex: 1,
    },
    unreadMessage: {
      fontWeight: "500",
      color: colors.textPrimary,
    },
    unreadBadge: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
      marginLeft: 8,
    },
    unreadBadgeText: {
      color: colors.primaryOn,
      fontSize: 12,
      fontWeight: "600",
    },
  });
