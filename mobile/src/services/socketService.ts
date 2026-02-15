import NetInfo from "@react-native-community/netinfo";
import io, { Socket } from "socket.io-client";
import { API_URL } from "../api/client";
import { API_BASE_URL, SOCKET_URL as CONFIG_SOCKET_URL } from "../config";
import { supabase } from "../lib/supabase";
import { logger } from "../utils/logger";
import monitoringService from "./monitoringService";

const defaultSocketUrl = "http://localhost:8080";

const resolveSocketUrl = (): string => {
  if (CONFIG_SOCKET_URL) {
    return CONFIG_SOCKET_URL;
  }

  const candidate = API_BASE_URL || API_URL;

  try {
    const url = new URL(candidate);
    return url.origin;
  } catch {
    return defaultSocketUrl;
  }
};

const SOCKET_URL = resolveSocketUrl();

logger.info("🔌", "Socket URL:", SOCKET_URL);

const RECONNECTION_ATTEMPTS = 5;
const RECONNECTION_DELAY = 2000;

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  content: string;
  messageType: "text" | "image" | "audio" | "video" | "gif" | "file";
  isEdited: boolean;
  readBy: string[];
  createdAt: Date;
  updatedAt?: Date;
  deliveredTo?: string[];
  senderName?: string;
  senderAvatar?: string;
}

export interface TypingIndicator {
  userId: string;
  conversationId: string;
  isTyping: boolean;
}

export interface OnlineStatus {
  userId: string;
  isOnline: boolean;
  lastSeen?: Date;
}

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private listeners: Map<string, Set<Function>> = new Map();

  // Event handlers
  private onMessageCallback: ((message: Message) => void) | null = null;
  private onTypingCallback: ((typing: TypingIndicator) => void) | null = null;
  private onOnlineStatusCallback: ((status: OnlineStatus) => void) | null =
    null;
  private onConnectionChangeCallback: ((connected: boolean) => void) | null =
    null;

  /**
   * Initialize socket connection
   */
  async connect(): Promise<boolean> {
    if (this.socket?.connected) {
      console.log("Socket already connected");
      return true;
    }

    if (this.isConnecting) {
      console.log("Socket connection already in progress");
      return false;
    }

    try {
      this.isConnecting = true;

      // Get auth token from Supabase session
      const { data } = await supabase.auth.getSession();
      this.token = data.session?.access_token || null;
      console.log("🔑 Socket token retrieved:", {
        hasToken: !!this.token,
        tokenLength: this.token?.length || 0,
        tokenPreview: this.token?.substring(0, 20) + "...",
      });

      if (!this.token) {
        console.log("⏳ No auth token found - will connect after login");
        this.isConnecting = false;
        return false;
      }

      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log("⚠️ No internet connection");
        this.isConnecting = false;
        return false;
      }

      // Create socket instance
      this.socket = io(SOCKET_URL, {
        auth: {
          token: this.token,
        },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: RECONNECTION_ATTEMPTS,
        reconnectionDelay: RECONNECTION_DELAY,
        timeout: 10000,
      });

      // Setup event listeners
      this.setupEventListeners();

      return new Promise((resolve) => {
        this.socket?.on("connect", () => {
          console.log("✅ Socket connected:", this.socket?.id);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.onConnectionChangeCallback?.(true);
          monitoringService.trackEvent("socket_connected", {
            socketId: this.socket?.id,
          });
          resolve(true);
        });

        this.socket?.on("connect_error", (error) => {
          console.error("❌ Socket connection error:", error);
          this.isConnecting = false;
          this.reconnectAttempts++;
          monitoringService.captureException(error, {
            phase: "connect_error",
            attempts: this.reconnectAttempts,
          });
          resolve(false);
        });
      });
    } catch (error) {
      console.error("❌ Failed to connect socket:", error);
      this.isConnecting = false;
      return false;
    }
  }

  /**
   * Disconnect socket and clean up all event listeners
   */
  disconnect(): void {
    if (this.socket) {
      console.log("🔌 Disconnecting socket and cleaning up listeners...");

      // Remove all socket event listeners to prevent memory leaks
      this.removeAllSocketListeners();

      // Disconnect the socket
      this.socket.disconnect();
      this.socket = null;

      // Clear all custom listeners
      this.listeners.clear();

      // Clear callbacks
      this.onMessageCallback = null;
      this.onTypingCallback = null;
      this.onOnlineStatusCallback = null;

      // Notify connection change
      this.onConnectionChangeCallback?.(false);
      this.onConnectionChangeCallback = null;

      console.log("✅ Socket disconnected and cleaned up");
      monitoringService.trackEvent("socket_disconnected");
    }
  }

  /**
   * Remove all socket event listeners
   */
  private removeAllSocketListeners(): void {
    if (!this.socket) return;

    console.log("🧹 Removing all socket event listeners...");

    // Connection events
    this.socket.off("disconnect");
    this.socket.off("reconnect");
    this.socket.off("reconnect_error");
    this.socket.off("connect_error");

    // Message events
    this.socket.off("message:receive");
    this.socket.off("message:sent");
    this.socket.off("group:message:receive");
    this.socket.off("message:delivered");
    this.socket.off("message:read");

    // Typing indicators
    this.socket.off("typing:start");
    this.socket.off("typing:stop");

    // Online status
    this.socket.off("user:online");
    this.socket.off("user:offline");

    // Social events
    this.socket.off("friend:request:receive");
    this.socket.off("friend:request:accepted");
    this.socket.off("group:invite:receive");
    this.socket.off("achievement:unlocked");

    console.log("✅ All socket event listeners removed");
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Setup socket event listeners
   * Note: This method removes old listeners before adding new ones to prevent duplicates
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    console.log("🔧 Setting up socket event listeners...");

    // Remove any existing listeners first to prevent duplicates
    this.removeAllSocketListeners();

    // Connection events
    this.socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      this.onConnectionChangeCallback?.(false);
      monitoringService.trackEvent("socket_disconnect", { reason });

      // Auto-reconnect if not manual disconnect
      if (reason === "io server disconnect") {
        setTimeout(() => this.connect(), RECONNECTION_DELAY);
      }
    });

    this.socket.on("reconnect", (attemptNumber) => {
      console.log("Socket reconnected after", attemptNumber, "attempts");
      this.onConnectionChangeCallback?.(true);
      monitoringService.trackEvent("socket_reconnect", {
        attempts: attemptNumber,
      });
    });

    this.socket.on("reconnect_error", (error) => {
      console.error("Socket reconnection error:", error);
      monitoringService.captureException(error, { phase: "reconnect_error" });
    });

    // Message events
    this.socket.on("message:receive", (data) => {
      console.log("Message received:", data);
      const decryptedMessage = this.decryptMessage(data);
      this.onMessageCallback?.(decryptedMessage);
      this.emit("message:receive", decryptedMessage);
    });

    this.socket.on("message:sent", (data) => {
      console.log("📤 Message sent confirmation:", data);
      const decryptedMessage = this.decryptMessage(data);
      console.log("📤 Decrypted message:", decryptedMessage);
      console.log("📤 Has onMessageCallback?", !!this.onMessageCallback);
      // Treat sent messages same as received for local display
      this.onMessageCallback?.(decryptedMessage);
      this.emit("message:sent", decryptedMessage);
    });

    this.socket.on("group:message:receive", (data) => {
      console.log("Group message received:", data);
      const decryptedMessage = this.decryptMessage(data);
      this.onMessageCallback?.(decryptedMessage);
      this.emit("group:message:receive", decryptedMessage);
    });

    this.socket.on("message:delivered", (data) => {
      console.log("Message delivered:", data);
      this.emit("message:delivered", data);
    });

    this.socket.on("message:read", (data) => {
      console.log("Message read:", data);
      this.emit("message:read", data);
    });

    // Typing indicators
    this.socket.on("typing:start", (data) => {
      this.onTypingCallback?.(data);
      this.emit("typing:start", data);
    });

    this.socket.on("typing:stop", (data) => {
      this.onTypingCallback?.(data);
      this.emit("typing:stop", data);
    });

    // Online status
    this.socket.on("user:online", (data) => {
      this.onOnlineStatusCallback?.(data);
      this.emit("user:online", data);
    });

    this.socket.on("user:offline", (data) => {
      this.onOnlineStatusCallback?.(data);
      this.emit("user:offline", data);
    });

    // Social events
    this.socket.on("friend:request:receive", (data) => {
      console.log("Friend request received:", data);
      this.emit("friend:request:receive", data);
    });

    this.socket.on("friend:request:accepted", (data) => {
      console.log("Friend request accepted:", data);
      this.emit("friend:request:accepted", data);
    });

    this.socket.on("group:invite:receive", (data) => {
      console.log("Group invitation received:", data);
      this.emit("group:invite:receive", data);
    });

    this.socket.on("achievement:unlocked", (data) => {
      console.log("Achievement unlocked:", data);
      this.emit("achievement:unlocked", data);
    });
  }

  /**
   * Send a direct message
   */
  async sendDirectMessage(
    recipientId: string,
    content: string,
    messageType: "text" | "image" | "audio" | "video" | "gif" | "file" = "text"
  ): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error("Socket not connected");
    }

    // Message encryption is handled on the backend
    this.socket.emit("message:send", {
      recipientId,
      content,
      messageType,
      timestamp: new Date(),
    });
  }

  /**
   * Send a group message
   */
  async sendGroupMessage(
    groupId: string,
    content: string,
    messageType: "text" | "image" | "audio" | "video" | "gif" | "file" = "text"
  ): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error("Socket not connected");
    }

    this.socket.emit("group:message:send", {
      groupId,
      content,
      messageType,
      timestamp: new Date(),
    });
  }

  /**
   * Join a group chat room
   */
  joinGroup(groupId: string): void {
    if (!this.socket?.connected) {
      console.warn("Socket not connected, cannot join group");
      return;
    }

    console.log(`🔗 Joining group: ${groupId}`);
    this.socket.emit("group:join", groupId);
  }

  /**
   * Leave a group chat room
   */
  leaveGroup(groupId: string): void {
    if (!this.socket?.connected) {
      console.warn("Socket not connected, cannot leave group");
      return;
    }

    console.log(`🚪 Leaving group: ${groupId}`);
    this.socket.emit("group:leave", groupId);
  }

  /**
   * Send typing indicator
   */
  sendTypingIndicator(conversationId: string, isTyping: boolean): void {
    if (!this.socket?.connected) return;

    const event = isTyping ? "typing:start" : "typing:stop";
    this.socket.emit(event, { conversationId });
  }

  /**
   * Mark message as read
   */
  markMessageAsRead(messageId: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit("message:read", { messageId });
  }

  /**
   * Join a conversation room
   */
  joinConversation(conversationId: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit("conversation:join", { conversationId });
  }

  /**
   * Leave a conversation room
   */
  leaveConversation(conversationId: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit("conversation:leave", { conversationId });
  }

  /**
   * Decrypt message content (if needed on client side)
   */
  private decryptMessage(message: any): Message {
    // Backend handles decryption, but we could add client-side decryption here if needed
    return {
      ...message,
      // Use timestamp if createdAt is not present, and ensure it's a valid Date
      createdAt: new Date(message.createdAt || message.timestamp),
      // Add default values for optional fields
      readBy: message.readBy || [],
      reactions: message.reactions || [],
    };
  }

  /**
   * Register event listener
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  /**
   * Emit custom event to listeners
   */
  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => callback(data));
    }
  }

  /**
   * Set message callback
   */
  onMessage(callback: (message: Message) => void): void {
    this.onMessageCallback = callback;
  }

  offMessage(callback?: (message: Message) => void): void {
    if (!callback || this.onMessageCallback === callback) {
      this.onMessageCallback = null;
    }
  }

  /**
   * Set typing callback
   */
  onTyping(callback: (typing: TypingIndicator) => void): void {
    this.onTypingCallback = callback;
  }

  offTyping(callback?: (typing: TypingIndicator) => void): void {
    if (!callback || this.onTypingCallback === callback) {
      this.onTypingCallback = null;
    }
  }

  /**
   * Set online status callback
   */
  onOnlineStatus(callback: (status: OnlineStatus) => void): void {
    this.onOnlineStatusCallback = callback;
  }

  offOnlineStatus(callback?: (status: OnlineStatus) => void): void {
    if (!callback || this.onOnlineStatusCallback === callback) {
      this.onOnlineStatusCallback = null;
    }
  }

  /**
   * Set connection change callback
   */
  onConnectionChange(callback: (connected: boolean) => void): void {
    this.onConnectionChangeCallback = callback;
  }

  offConnectionChange(callback?: (connected: boolean) => void): void {
    if (!callback || this.onConnectionChangeCallback === callback) {
      this.onConnectionChangeCallback = null;
    }
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Get diagnostic information for debugging memory leaks
   */
  getDiagnostics(): {
    isConnected: boolean;
    isConnecting: boolean;
    reconnectAttempts: number;
    hasSocket: boolean;
    socketId?: string;
    activeListeners: number;
    listenerTypes: string[];
    hasCallbacks: {
      message: boolean;
      typing: boolean;
      onlineStatus: boolean;
      connectionChange: boolean;
    };
  } {
    const listenerTypes = Array.from(this.listeners.keys());
    const totalListeners = Array.from(this.listeners.values()).reduce(
      (sum, set) => sum + set.size,
      0
    );

    return {
      isConnected: this.isConnected(),
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      hasSocket: !!this.socket,
      socketId: this.socket?.id,
      activeListeners: totalListeners,
      listenerTypes,
      hasCallbacks: {
        message: !!this.onMessageCallback,
        typing: !!this.onTypingCallback,
        onlineStatus: !!this.onOnlineStatusCallback,
        connectionChange: !!this.onConnectionChangeCallback,
      },
    };
  }

  /**
   * Force cleanup - for testing and debugging only
   */
  forceCleanup(): void {
    console.warn(
      "⚠️ Force cleanup called - this should only be used for testing!"
    );
    this.disconnect();
    this.token = null;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;
