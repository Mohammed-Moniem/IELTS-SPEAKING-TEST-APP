import { apiClient } from "../../api/client";

export interface FriendRequest {
  _id: string;
  senderId: {
    _id: string;
    email: string;
    username?: string;
  };
  receiverId: {
    // Backend uses receiverId, not recipientId
    _id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  status: "pending" | "accepted" | "declined" | "cancelled";
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Friend {
  _id: string;
  userId: string; // Can be the friend's userId (flat structure from backend)
  username?: string; // Backend returns flat structure with username
  avatar?: string;
  bio?: string;
  lastActive?: string;
  // Legacy nested structure (for backward compatibility)
  friendId?: {
    _id: string;
    email: string;
    username?: string;
    avatar?: string;
    isOnline?: boolean;
  };
  becameFriendsAt?: string;
  mutualFriends?: number;
}

export interface UserSearchResult {
  _id: string;
  email: string;
  username?: string;
  avatar?: string;
  isFriend: boolean;
  hasPendingRequest: boolean;
}

export interface FriendSuggestion {
  _id: string;
  email: string;
  username?: string;
  avatar?: string;
  mutualFriends: number;
  matchScore: number;
  matchReasons: string[];
}

class FriendService {
  /**
   * Send a friend request
   */
  async sendFriendRequest(
    recipientId: string,
    message?: string
  ): Promise<FriendRequest> {
    const response = await apiClient.post(`/friends/request`, {
      recipientId,
      message,
    });
    return response.data.data;
  }

  /**
   * Get pending friend requests received
   */
  async getPendingRequests(): Promise<FriendRequest[]> {
    const response = await apiClient.get(`/friends/requests`);
    return response.data.data;
  }

  /**
   * Get sent friend requests
   */
  async getSentRequests(): Promise<FriendRequest[]> {
    const response = await apiClient.get(`/friends/requests/sent`);
    return response.data.data;
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(requestId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/friends/accept/${requestId}`, {});
    return response.data;
  }

  /**
   * Decline a friend request
   */
  async declineFriendRequest(requestId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/friends/decline/${requestId}`, {});
    return response.data;
  }

  /**
   * Remove a friend
   */
  async removeFriend(friendId: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/friends/${friendId}`);
    return response.data;
  }

  /**
   * Get list of friends
   */
  async getFriends(): Promise<Friend[]> {
    const response = await apiClient.get(`/friends`);
    return response.data.data;
  }

  /**
   * Search for users
   */
  async searchUsers(query: string): Promise<UserSearchResult[]> {
    const response = await apiClient.get(`/friends/search`, {
      params: { q: query },
    });
    return response.data.data;
  }

  /**
   * Get friend suggestions
   */
  async getFriendSuggestions(limit: number = 10): Promise<FriendSuggestion[]> {
    const response = await apiClient.get(`/friends/suggestions`, {
      params: { limit },
    });
    return response.data.data;
  }

  /**
   * Block a user
   */
  async blockUser(userId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/friends/block/${userId}`, {});
    return response.data;
  }

  /**
   * Get blocked users
   */
  async getBlockedUsers(): Promise<
    Array<{ _id: string; email: string; username?: string }>
  > {
    const response = await apiClient.get(`/friends/blocked`);
    return response.data.data;
  }
}

export default new FriendService();
