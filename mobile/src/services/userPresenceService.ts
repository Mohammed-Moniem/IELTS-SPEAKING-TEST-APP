import { socketService } from "./socketService";

/**
 * User presence status
 */
export interface UserPresence {
  userId: string;
  isOnline: boolean;
  lastSeen?: Date;
}

/**
 * User Presence Service
 * Manages online/offline status and last seen timestamps for users
 */
class UserPresenceService {
  private presenceMap: Map<string, UserPresence> = new Map();
  private listeners: Set<(userId: string, presence: UserPresence) => void> =
    new Set();

  constructor() {
    this.setupSocketListeners();
  }

  /**
   * Setup Socket.IO event listeners for presence updates
   */
  private setupSocketListeners(): void {
    // Listen for user coming online
    socketService.on(
      "user:online",
      (data: { userId: string; timestamp?: string }) => {
        this.updatePresence(data.userId, {
          userId: data.userId,
          isOnline: true,
          lastSeen: data.timestamp ? new Date(data.timestamp) : new Date(),
        });
      }
    );

    // Listen for user going offline
    socketService.on(
      "user:offline",
      (data: { userId: string; lastSeen?: string }) => {
        this.updatePresence(data.userId, {
          userId: data.userId,
          isOnline: false,
          lastSeen: data.lastSeen ? new Date(data.lastSeen) : new Date(),
        });
      }
    );
  }

  /**
   * Update presence for a user
   */
  private updatePresence(userId: string, presence: UserPresence): void {
    this.presenceMap.set(userId, presence);

    // Notify all listeners
    this.listeners.forEach((listener) => {
      listener(userId, presence);
    });
  }

  /**
   * Get presence for a specific user
   */
  getPresence(userId: string): UserPresence | null {
    return this.presenceMap.get(userId) || null;
  }

  /**
   * Check if a user is online
   */
  isUserOnline(userId: string): boolean {
    const presence = this.presenceMap.get(userId);
    return presence?.isOnline || false;
  }

  /**
   * Get last seen timestamp for a user
   */
  getLastSeen(userId: string): Date | null {
    const presence = this.presenceMap.get(userId);
    return presence?.lastSeen || null;
  }

  /**
   * Format last seen timestamp for display
   * Returns: "Online", "Last seen just now", "Last seen 5m ago", etc.
   */
  formatLastSeen(userId: string): string {
    const presence = this.presenceMap.get(userId);

    if (!presence) {
      return "Offline";
    }

    if (presence.isOnline) {
      return "Online";
    }

    if (!presence.lastSeen) {
      return "Offline";
    }

    const now = new Date();
    const lastSeen = new Date(presence.lastSeen);
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return "Last seen just now";
    } else if (diffMins < 60) {
      return `Last seen ${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `Last seen ${diffHours}h ago`;
    } else if (diffDays === 1) {
      return "Last seen yesterday";
    } else if (diffDays < 7) {
      return `Last seen ${diffDays}d ago`;
    } else {
      // Format as date for older timestamps
      const month = lastSeen.toLocaleDateString("en-US", { month: "short" });
      const day = lastSeen.getDate();
      return `Last seen ${month} ${day}`;
    }
  }

  /**
   * Subscribe to presence updates
   * Returns unsubscribe function
   */
  subscribe(
    listener: (userId: string, presence: UserPresence) => void
  ): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Set multiple user presences at once (for initial load)
   */
  setPresences(presences: UserPresence[]): void {
    presences.forEach((presence) => {
      this.presenceMap.set(presence.userId, presence);
    });
  }

  /**
   * Clear all presence data
   */
  clear(): void {
    this.presenceMap.clear();
  }

  /**
   * Get all online users
   */
  getOnlineUsers(): string[] {
    const onlineUsers: string[] = [];
    this.presenceMap.forEach((presence, userId) => {
      if (presence.isOnline) {
        onlineUsers.push(userId);
      }
    });
    return onlineUsers;
  }

  /**
   * Get presence for multiple users
   */
  getMultiplePresences(userIds: string[]): Map<string, UserPresence> {
    const presences = new Map<string, UserPresence>();
    userIds.forEach((userId) => {
      const presence = this.presenceMap.get(userId);
      if (presence) {
        presences.set(userId, presence);
      }
    });
    return presences;
  }
}

// Export singleton instance
export const userPresenceService = new UserPresenceService();
