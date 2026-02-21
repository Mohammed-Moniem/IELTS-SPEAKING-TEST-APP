import { socketService } from "./socketService";

/**
 * Typing user information
 */
export interface TypingUser {
  userId: string;
  userName?: string;
  conversationId: string;
  timestamp: Date;
}

/**
 * Typing Indicator Service
 * Manages typing indicators for conversations
 */
class TypingIndicatorService {
  private typingUsers: Map<string, Map<string, TypingUser>> = new Map(); // conversationId -> userId -> TypingUser
  private listeners: Set<
    (conversationId: string, typingUsers: TypingUser[]) => void
  > = new Set();
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map(); // userId -> timeout
  private readonly TYPING_TIMEOUT = 3000; // 3 seconds

  constructor() {
    this.setupSocketListeners();
  }

  /**
   * Setup Socket.IO event listeners for typing indicators
   */
  private setupSocketListeners(): void {
    // Listen for user starting to type
    socketService.on(
      "typing:start",
      (data: {
        userId: string;
        userName?: string;
        conversationId: string;
        timestamp?: string;
      }) => {
        this.addTypingUser({
          userId: data.userId,
          userName: data.userName,
          conversationId: data.conversationId,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        });
      }
    );

    // Listen for user stopping typing
    socketService.on(
      "typing:stop",
      (data: { userId: string; conversationId: string }) => {
        this.removeTypingUser(data.conversationId, data.userId);
      }
    );
  }

  /**
   * Add a typing user to a conversation
   */
  private addTypingUser(typingUser: TypingUser): void {
    const { conversationId, userId } = typingUser;

    // Get or create conversation typing map
    let conversationTyping = this.typingUsers.get(conversationId);
    if (!conversationTyping) {
      conversationTyping = new Map();
      this.typingUsers.set(conversationId, conversationTyping);
    }

    // Add user to typing map
    conversationTyping.set(userId, typingUser);

    // Clear existing timeout
    const existingTimeout = this.typingTimeouts.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set auto-remove timeout (in case typing:stop is not received)
    const timeout = setTimeout(() => {
      this.removeTypingUser(conversationId, userId);
    }, this.TYPING_TIMEOUT);
    this.typingTimeouts.set(userId, timeout);

    // Notify listeners
    this.notifyListeners(conversationId);
  }

  /**
   * Remove a typing user from a conversation
   */
  private removeTypingUser(conversationId: string, userId: string): void {
    const conversationTyping = this.typingUsers.get(conversationId);
    if (!conversationTyping) return;

    // Remove user from typing map
    conversationTyping.delete(userId);

    // Clear timeout
    const timeout = this.typingTimeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.typingTimeouts.delete(userId);
    }

    // Clean up empty conversation maps
    if (conversationTyping.size === 0) {
      this.typingUsers.delete(conversationId);
    }

    // Notify listeners
    this.notifyListeners(conversationId);
  }

  /**
   * Notify listeners about typing changes
   */
  private notifyListeners(conversationId: string): void {
    const typingUsers = this.getTypingUsers(conversationId);
    this.listeners.forEach((listener) => {
      listener(conversationId, typingUsers);
    });
  }

  /**
   * Get all typing users for a conversation
   */
  getTypingUsers(conversationId: string): TypingUser[] {
    const conversationTyping = this.typingUsers.get(conversationId);
    if (!conversationTyping) return [];

    return Array.from(conversationTyping.values());
  }

  /**
   * Check if any user is typing in a conversation
   */
  isAnyoneTyping(conversationId: string): boolean {
    const conversationTyping = this.typingUsers.get(conversationId);
    return conversationTyping ? conversationTyping.size > 0 : false;
  }

  /**
   * Check if a specific user is typing in a conversation
   */
  isUserTyping(conversationId: string, userId: string): boolean {
    const conversationTyping = this.typingUsers.get(conversationId);
    return conversationTyping ? conversationTyping.has(userId) : false;
  }

  /**
   * Format typing indicator text for display
   * Returns: "John is typing...", "John and Jane are typing...", "John, Jane and 2 others are typing..."
   */
  formatTypingText(conversationId: string, currentUserId?: string): string {
    let typingUsers = this.getTypingUsers(conversationId);

    // Filter out current user (they shouldn't see their own typing indicator)
    if (currentUserId) {
      typingUsers = typingUsers.filter((user) => user.userId !== currentUserId);
    }

    if (typingUsers.length === 0) {
      return "";
    }

    if (typingUsers.length === 1) {
      const name = typingUsers[0].userName || "Someone";
      return `${name} is typing...`;
    }

    if (typingUsers.length === 2) {
      const name1 = typingUsers[0].userName || "Someone";
      const name2 = typingUsers[1].userName || "Someone";
      return `${name1} and ${name2} are typing...`;
    }

    // More than 2 users
    const name1 = typingUsers[0].userName || "Someone";
    const name2 = typingUsers[1].userName || "Someone";
    const othersCount = typingUsers.length - 2;
    return `${name1}, ${name2} and ${othersCount} ${
      othersCount === 1 ? "other" : "others"
    } are typing...`;
  }

  /**
   * Send typing indicator to server
   */
  sendTypingIndicator(conversationId: string, isTyping: boolean): void {
    socketService.sendTypingIndicator(conversationId, isTyping);
  }

  /**
   * Subscribe to typing updates
   * Returns unsubscribe function
   */
  subscribe(
    listener: (conversationId: string, typingUsers: TypingUser[]) => void
  ): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Clear all typing data
   */
  clear(): void {
    // Clear all timeouts
    this.typingTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.typingTimeouts.clear();

    // Clear typing users
    this.typingUsers.clear();
  }

  /**
   * Clear typing users for a specific conversation
   */
  clearConversation(conversationId: string): void {
    const conversationTyping = this.typingUsers.get(conversationId);
    if (!conversationTyping) return;

    // Clear timeouts for all users in this conversation
    conversationTyping.forEach((_, userId) => {
      const timeout = this.typingTimeouts.get(userId);
      if (timeout) {
        clearTimeout(timeout);
        this.typingTimeouts.delete(userId);
      }
    });

    // Remove conversation
    this.typingUsers.delete(conversationId);

    // Notify listeners
    this.notifyListeners(conversationId);
  }
}

// Export singleton instance
export const typingIndicatorService = new TypingIndicatorService();
