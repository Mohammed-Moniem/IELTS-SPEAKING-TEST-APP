import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import io, { Socket } from "socket.io-client";

const SOCKET_URL = process.env.SOCKET_URL || "http://localhost:8080";
const RECONNECTION_ATTEMPTS = 5;
const RECONNECTION_DELAY = 2000;

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  content: string;
  messageType: "text" | "image" | "audio" | "file";
  isEdited: boolean;
  readBy: string[];
  createdAt: Date;
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

      // Get auth token
      this.token = await AsyncStorage.getItem("authToken");
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
          resolve(true);
        });

        this.socket?.on("connect_error", (error) => {
          console.error("❌ Socket connection error:", error);
          this.isConnecting = false;
          this.reconnectAttempts++;
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
   * Disconnect socket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.onConnectionChangeCallback?.(false);
      console.log("Socket disconnected");
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Setup socket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      this.onConnectionChangeCallback?.(false);

      // Auto-reconnect if not manual disconnect
      if (reason === "io server disconnect") {
        setTimeout(() => this.connect(), RECONNECTION_DELAY);
      }
    });

    this.socket.on("reconnect", (attemptNumber) => {
      console.log("Socket reconnected after", attemptNumber, "attempts");
      this.onConnectionChangeCallback?.(true);
    });

    this.socket.on("reconnect_error", (error) => {
      console.error("Socket reconnection error:", error);
    });

    // Message events
    this.socket.on("message:receive", (data) => {
      console.log("Message received:", data);
      const decryptedMessage = this.decryptMessage(data);
      this.onMessageCallback?.(decryptedMessage);
      this.emit("message:receive", decryptedMessage);
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
    messageType: "text" | "image" | "audio" | "file" = "text"
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
    messageType: "text" | "image" | "audio" | "file" = "text"
  ): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error("Socket not connected");
    }

    this.socket.emit("message:group:send", {
      groupId,
      content,
      messageType,
      timestamp: new Date(),
    });
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
      createdAt: new Date(message.createdAt),
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

  /**
   * Set typing callback
   */
  onTyping(callback: (typing: TypingIndicator) => void): void {
    this.onTypingCallback = callback;
  }

  /**
   * Set online status callback
   */
  onOnlineStatus(callback: (status: OnlineStatus) => void): void {
    this.onOnlineStatusCallback = callback;
  }

  /**
   * Set connection change callback
   */
  onConnectionChange(callback: (connected: boolean) => void): void {
    this.onConnectionChangeCallback = callback;
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;
