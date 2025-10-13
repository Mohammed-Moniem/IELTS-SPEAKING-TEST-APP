import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../../config";

export interface FriendRequest {
  _id: string;
  senderId: {
    _id: string;
    email: string;
    username?: string;
  };
  recipientId: {
    _id: string;
    email: string;
    username?: string;
  };
  status: "pending" | "accepted" | "declined" | "cancelled";
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Friend {
  _id: string;
  userId: string;
  friendId: {
    _id: string;
    email: string;
    username?: string;
    avatar?: string;
    isOnline?: boolean;
  };
  becameFriendsAt: string;
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

const getAuthToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem("authToken");
};

const getAuthHeaders = async () => {
  const token = await getAuthToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

class FriendService {
  /**
   * Send a friend request
   */
  async sendFriendRequest(
    recipientId: string,
    message?: string
  ): Promise<FriendRequest> {
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}/friends/request`,
      { recipientId, message },
      { headers }
    );
    return response.data.data;
  }

  /**
   * Get pending friend requests received
   */
  async getPendingRequests(): Promise<FriendRequest[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/friends/requests`, {
      headers,
    });
    return response.data.data;
  }

  /**
   * Get sent friend requests
   */
  async getSentRequests(): Promise<FriendRequest[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(
      `${API_BASE_URL}/friends/requests/sent`,
      { headers }
    );
    return response.data.data;
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(requestId: string): Promise<{ message: string }> {
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}/friends/accept/${requestId}`,
      {},
      { headers }
    );
    return response.data;
  }

  /**
   * Decline a friend request
   */
  async declineFriendRequest(requestId: string): Promise<{ message: string }> {
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}/friends/decline/${requestId}`,
      {},
      { headers }
    );
    return response.data;
  }

  /**
   * Remove a friend
   */
  async removeFriend(friendId: string): Promise<{ message: string }> {
    const headers = await getAuthHeaders();
    const response = await axios.delete(
      `${API_BASE_URL}/friends/${friendId}`,
      { headers }
    );
    return response.data;
  }

  /**
   * Get list of friends
   */
  async getFriends(): Promise<Friend[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/friends`, {
      headers,
    });
    return response.data.data;
  }

  /**
   * Search for users
   */
  async searchUsers(query: string): Promise<UserSearchResult[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/friends/search`, {
      headers,
      params: { q: query },
    });
    return response.data.data;
  }

  /**
   * Get friend suggestions
   */
  async getFriendSuggestions(limit: number = 10): Promise<FriendSuggestion[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(
      `${API_BASE_URL}/friends/suggestions`,
      {
        headers,
        params: { limit },
      }
    );
    return response.data.data;
  }

  /**
   * Block a user
   */
  async blockUser(userId: string): Promise<{ message: string }> {
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}/friends/block/${userId}`,
      {},
      { headers }
    );
    return response.data;
  }

  /**
   * Get blocked users
   */
  async getBlockedUsers(): Promise<
    Array<{ _id: string; email: string; username?: string }>
  > {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/friends/blocked`, {
      headers,
    });
    return response.data.data;
  }
}

export default new FriendService();
