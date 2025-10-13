import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useChat } from "../../hooks";
import type { ChatMessage } from "../../services/api/chatService";

export const ChatScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const {
    conversationId,
    recipientId,
    recipientName,
    isGroupChat = false,
  } = route.params || {};

  const {
    messages,
    loading,
    loadingMore,
    hasMore,
    sendMessage,
    sendGroupMessage,
    loadMessages,
    markAsRead,
    sendTypingIndicator,
  } = useChat(conversationId);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId, true);
    }
    navigation.setOptions({ title: recipientName || "Chat" });
  }, [conversationId]);

  // Mark messages as read
  useEffect(() => {
    if (messages.length > 0 && conversationId) {
      messages.forEach((msg) => {
        if (!msg.readBy.includes("currentUserId")) {
          // Replace with actual user ID
          markAsRead(msg._id);
        }
      });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      if (isGroupChat) {
        await sendGroupMessage(recipientId, text, "text");
      } else {
        await sendMessage(recipientId, text, "text");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (text: string) => {
    setInputText(text);

    if (conversationId) {
      sendTypingIndicator(conversationId, true);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator(conversationId, false);
      }, 2000);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${hours % 12 || 12}:${minutes.toString().padStart(2, "0")} ${
      hours >= 12 ? "PM" : "AM"
    }`;
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.senderId === "currentUserId"; // Replace with actual user ID
    const showTimestamp = true; // Could be more sophisticated

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage && styles.ownMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownMessage : styles.otherMessage,
          ]}
        >
          <Text
            style={[styles.messageText, isOwnMessage && styles.ownMessageText]}
          >
            {item.content}
          </Text>
          {showTimestamp && (
            <Text
              style={[styles.timestamp, isOwnMessage && styles.ownTimestamp]}
            >
              {formatTimestamp(item.createdAt)}
              {isOwnMessage && item.readBy.length > 1 && " ✓✓"}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && conversationId) {
      loadMessages(conversationId, false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {loading && messages.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          inverted
          contentContainerStyle={styles.messagesList}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                size="small"
                color="#007AFF"
                style={{ marginVertical: 10 }}
              />
            ) : null
          }
        />
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton}>
          <Ionicons name="add-circle" size={32} color="#007AFF" />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={handleTyping}
          placeholder="Message..."
          placeholderTextColor="#8E8E93"
          multiline
          maxLength={2000}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            !inputText.trim() && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: "75%",
  },
  ownMessageContainer: {
    alignSelf: "flex-end",
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ownMessage: {
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  messageText: {
    fontSize: 16,
    color: "#000000",
    lineHeight: 20,
  },
  ownMessageText: {
    color: "#FFFFFF",
  },
  timestamp: {
    fontSize: 11,
    color: "#8E8E93",
    marginTop: 4,
  },
  ownTimestamp: {
    color: "rgba(255,255,255,0.8)",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C7C7CC",
  },
  attachButton: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 100,
    color: "#000000",
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
