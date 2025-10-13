import { useCallback, useEffect, useRef, useState } from "react";
import chatService, {
  ChatMessage,
  Conversation,
} from "../services/api/chatService";
import socketService from "../services/socketService";

export const useChat = (conversationId?: string) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const oldestMessageId = useRef<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await chatService.getConversations();
      setConversations(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (convId: string, refresh = false) => {
    try {
      if (refresh) {
        setLoading(true);
        oldestMessageId.current = null;
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const data = await chatService.getMessages(
        convId,
        50,
        oldestMessageId.current || undefined
      );

      if (refresh) {
        setMessages(data);
      } else {
        setMessages((prev) => [...prev, ...data]);
      }

      if (data.length > 0) {
        oldestMessageId.current = data[data.length - 1]._id;
      }

      setHasMore(data.length === 50);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load messages");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (
      recipientId: string,
      content: string,
      messageType: "text" | "image" | "audio" | "file" = "text"
    ) => {
      try {
        setError(null);
        // Send via Socket.io for real-time delivery
        socketService.sendDirectMessage(recipientId, content, messageType);
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to send message");
        return false;
      }
    },
    []
  );

  const sendGroupMessage = useCallback(
    async (
      groupId: string,
      content: string,
      messageType: "text" | "image" | "audio" | "file" = "text"
    ) => {
      try {
        setError(null);
        socketService.sendGroupMessage(groupId, content, messageType);
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to send group message");
        return false;
      }
    },
    []
  );

  const markAsRead = useCallback(async (messageId: string) => {
    try {
      await chatService.markMessageAsRead(messageId);
    } catch (err: any) {
      console.error("Failed to mark message as read:", err);
    }
  }, []);

  const markConversationAsRead = useCallback(async (convId: string) => {
    try {
      await chatService.markConversationAsRead(convId);
      await Promise.all([loadConversations(), loadUnreadCount()]);
    } catch (err: any) {
      console.error("Failed to mark conversation as read:", err);
    }
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      setError(null);
      await chatService.deleteMessage(messageId);
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete message");
      return false;
    }
  }, []);

  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      try {
        setError(null);
        const updatedMessage = await chatService.editMessage(
          messageId,
          newContent
        );
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId ? { ...msg, ...updatedMessage } : msg
          )
        );
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to edit message");
        return false;
      }
    },
    []
  );

  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await chatService.getUnreadCount();
      setUnreadCount(count);
    } catch (err: any) {
      console.error("Failed to load unread count:", err);
    }
  }, []);

  const searchMessages = useCallback(
    async (convId: string, query: string): Promise<ChatMessage[]> => {
      try {
        setError(null);
        const results = await chatService.searchMessages(convId, query);
        return results;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to search messages");
        return [];
      }
    },
    []
  );

  const sendTypingIndicator = useCallback(
    (convId: string, isTyping: boolean) => {
      socketService.sendTypingIndicator(convId, isTyping);
    },
    []
  );

  // Listen for real-time message events
  useEffect(() => {
    const handleNewMessage = (message: ChatMessage) => {
      // Add to messages if it's for the current conversation
      if (conversationId && message.conversationId === conversationId) {
        setMessages((prev) => [message, ...prev]);
      }
      // Update conversations list
      loadConversations();
      loadUnreadCount();
    };

    socketService.onMessage(handleNewMessage);

    return () => {
      // Cleanup handled by socketService
    };
  }, [conversationId, loadConversations, loadUnreadCount]);

  // Load initial data
  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId, true);
    }
  }, [conversationId]);

  return {
    conversations,
    messages,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    error,
    loadConversations,
    loadMessages,
    sendMessage,
    sendGroupMessage,
    markAsRead,
    markConversationAsRead,
    deleteMessage,
    editMessage,
    loadUnreadCount,
    searchMessages,
    sendTypingIndicator,
  };
};
