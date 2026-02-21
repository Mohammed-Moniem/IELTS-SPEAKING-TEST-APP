import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../api/client";
import chatService, {
  ChatMessage,
  Conversation,
} from "../services/api/chatService";
import socketService, { Message } from "../services/socketService";

export const useChat = (conversationId?: string) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const oldestMessageTimestamp = useRef<string | null>(null);

  const toIsoString = useCallback((value: string | Date | undefined) => {
    if (!value) {
      return new Date().toISOString();
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return new Date().toISOString();
    }

    return date.toISOString();
  }, []);

  const apiOrigin =
    API_URL.replace(/\/api\/?.*$/i, "").replace(/\/+$/, "") || API_URL;

  const normalizeMessages = useCallback(
    (
      incoming: Array<
        ChatMessage & {
          createdAt: string | Date;
          updatedAt?: string | Date;
          metadata?: Record<string, any>;
          mediaUrl?: string;
          thumbnailUrl?: string;
        }
      >
    ): ChatMessage[] => {
      const ensureString = (value: any): string | undefined => {
        if (value === undefined || value === null) {
          return undefined;
        }
        if (typeof value === "string") {
          return value;
        }
        if (typeof value === "object" && value._id) {
          return ensureString(value._id);
        }
        if (typeof value.toString === "function") {
          return value.toString();
        }
        return undefined;
      };

      const makeAbsolute = (value?: string): string | undefined => {
        if (!value) {
          return undefined;
        }

        if (/^https?:\/\//i.test(value)) {
          return value;
        }

        const normalized = value.startsWith("/") ? value : `/${value}`;
        return `${apiOrigin}${normalized}`;
      };

      return incoming.map((message) => ({
        ...message,
        senderId: ensureString(message.senderId) ?? "",
        recipientId: ensureString(message.recipientId),
        groupId: ensureString(message.groupId),
        sender: message.sender
          ? {
              ...message.sender,
              _id: ensureString(message.sender?._id),
            }
          : undefined,
        recipient: message.recipient
          ? {
              ...message.recipient,
              _id: ensureString(message.recipient?._id),
            }
          : undefined,
        metadata:
          message.metadata && typeof message.metadata === "object"
            ? { ...message.metadata }
            : undefined,
        mediaUrl: makeAbsolute(
          message.mediaUrl ??
            (message.metadata as any)?.fileUrl ??
            (message.metadata as any)?.fileURL
        ),
        thumbnailUrl: makeAbsolute(
          message.thumbnailUrl ??
            (message.metadata as any)?.thumbnailUrl ??
            (message.metadata as any)?.thumbnailURL
        ),
        timestamp: toIsoString(message.timestamp ?? message.createdAt),
        readBy: Array.isArray(message.readBy)
          ? message.readBy
              .map((entry) => ensureString(entry))
              .filter((entry): entry is string => typeof entry === "string")
          : [],
        deliveredTo: Array.isArray(message.deliveredTo)
          ? message.deliveredTo
              .map((entry) => ensureString(entry))
              .filter((entry): entry is string => typeof entry === "string")
          : [],
        createdAt: toIsoString(message.createdAt),
        updatedAt: toIsoString(message.updatedAt ?? message.createdAt),
      }));
    },
    [apiOrigin, toIsoString]
  );

  const sortMessagesDesc = useCallback(
    (list: ChatMessage[]): ChatMessage[] =>
      [...list].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    []
  );

  const mergeMessageLists = useCallback(
    (existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] => {
      const messageMap = new Map<string, ChatMessage>();

      existing.forEach((msg) => messageMap.set(msg._id, msg));
      incoming.forEach((msg) => messageMap.set(msg._id, msg));

      const merged = Array.from(messageMap.values());
      return sortMessagesDesc(merged);
    },
    [sortMessagesDesc]
  );

  const addOptimisticMessage = useCallback(
    (message: ChatMessage) => {
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg._id !== message._id);
        return sortMessagesDesc([message, ...filtered]);
      });
    },
    [sortMessagesDesc]
  );

  const updateMessage = useCallback(
    (
      messageId: string,
      updates:
        | Partial<ChatMessage>
        | ((current: ChatMessage) => Partial<ChatMessage> | undefined)
    ) => {
      setMessages((prev) => {
        let changed = false;
        const next = prev.map((msg) => {
          if (msg._id !== messageId) {
            return msg;
          }
          const patch = typeof updates === "function" ? updates(msg) : updates;
          if (!patch) {
            return msg;
          }
          changed = true;
          return { ...msg, ...patch };
        });

        return changed ? next : prev;
      });
    },
    []
  );

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

  const loadMessages = useCallback(
    async (convId: string, refresh = false) => {
      const pageSize = 50;

      try {
        if (refresh) {
          setLoading(true);
          oldestMessageTimestamp.current = null;
        } else {
          setLoadingMore(true);
        }
        setError(null);

        const data = await chatService.getMessages(
          convId,
          pageSize,
          !refresh ? oldestMessageTimestamp.current || undefined : undefined
        );

        const normalized = normalizeMessages(
          data as Array<
            ChatMessage & {
              createdAt: string | Date;
              updatedAt?: string | Date;
            }
          >
        );

        if (refresh) {
          const sorted = sortMessagesDesc(normalized);
          setMessages(sorted);
          oldestMessageTimestamp.current =
            sorted.length > 0 ? sorted[sorted.length - 1].createdAt : null;
        } else {
          setMessages((prev) => {
            const merged = mergeMessageLists(prev, normalized);
            oldestMessageTimestamp.current =
              merged.length > 0 ? merged[merged.length - 1].createdAt : null;
            return merged;
          });
        }

        setHasMore(data.length === pageSize);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load messages");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [mergeMessageLists, normalizeMessages, sortMessagesDesc]
  );

  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await chatService.getUnreadCount();
      setUnreadCount(count);
    } catch (err: any) {
      console.error("Failed to load unread count:", err);
    }
  }, []);

  const sendMessage = useCallback(
    async (
      recipientId: string,
      content: string,
      messageType:
        | "text"
        | "image"
        | "audio"
        | "video"
        | "gif"
        | "file" = "text"
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
      messageType:
        | "text"
        | "image"
        | "audio"
        | "video"
        | "gif"
        | "file" = "text"
    ) => {
      try {
        console.log("📤 sendGroupMessage called:", {
          groupId,
          content,
          messageType,
        });
        setError(null);
        socketService.sendGroupMessage(groupId, content, messageType);
        return true;
      } catch (err: any) {
        console.error("❌ sendGroupMessage error:", err);
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

  const markConversationAsRead = useCallback(
    async (convId: string) => {
      try {
        await chatService.markConversationAsRead(convId);
        await Promise.all([loadConversations(), loadUnreadCount()]);
      } catch (err: any) {
        console.error("Failed to mark conversation as read:", err);
      }
    },
    [loadConversations, loadUnreadCount]
  );

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
    const handleNewMessage = (message: Message) => {
      console.log("📨 New message received in useChat:", {
        messageConversationId: message.conversationId,
        currentConversationId: conversationId,
        senderId: message.senderId,
        recipientId: message.recipientId,
        message,
      });

      // Add to messages if it's for the current conversation
      // Match by conversationId OR if we're in a new chat (no conversationId yet)
      const isForThisConversation = conversationId
        ? message.conversationId === conversationId
        : true; // Accept all messages if no conversationId set yet

      if (isForThisConversation) {
        console.log("✅ Adding message to local state");
        const [normalizedMessage] = normalizeMessages([
          {
            ...message,
            createdAt: message.createdAt || new Date(),
            updatedAt: message.updatedAt || message.createdAt || new Date(),
            readBy: message.readBy,
            deliveredTo: message.deliveredTo,
          } as ChatMessage & {
            createdAt: string | Date;
            updatedAt?: string | Date;
          },
        ]);

        setMessages((prev) => {
          if (prev.some((msg) => msg._id === normalizedMessage._id)) {
            return prev;
          }

          const updatedList = sortMessagesDesc([normalizedMessage, ...prev]);
          oldestMessageTimestamp.current =
            updatedList.length > 0
              ? updatedList[updatedList.length - 1].createdAt
              : oldestMessageTimestamp.current;
          return updatedList;
        });

        // Update conversationId if this is a new conversation
        if (!conversationId && message.conversationId) {
          console.log("🆕 Setting conversation ID:", message.conversationId);
          // Note: This will be handled by the parent component
        }
      } else {
        console.log("⚠️ Message not added - conversation ID mismatch");
      }
      // Update conversations list
      loadConversations();
      loadUnreadCount();
    };

    socketService.onMessage(handleNewMessage);

    return () => {
      socketService.offMessage(handleNewMessage);
    };
  }, [
    conversationId,
    loadConversations,
    loadUnreadCount,
    normalizeMessages,
    sortMessagesDesc,
  ]);

  // Load initial data
  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId, true);
    }
  }, [conversationId, loadMessages]);

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
    addOptimisticMessage,
    updateMessage,
  };
};
