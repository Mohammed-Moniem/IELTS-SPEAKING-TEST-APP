import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../../config";

export interface StudyGroup {
  _id: string;
  name: string;
  description: string;
  creatorId: string;
  adminIds: string[];
  memberIds: string[];
  memberCount: number;
  settings: {
    isPrivate: boolean;
    allowMemberInvites: boolean;
    requireApproval: boolean;
  };
  metadata?: {
    ieltsType?: "academic" | "general";
    targetCountry?: string;
    targetBand?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface StudyGroupInvite {
  _id: string;
  groupId: {
    _id: string;
    name: string;
    description: string;
  };
  inviterId: {
    _id: string;
    email: string;
    username?: string;
  };
  inviteeId: string;
  status: "pending" | "accepted" | "declined";
  message?: string;
  createdAt: string;
}

export interface GroupMember {
  _id: string;
  email: string;
  username?: string;
  avatar?: string;
  isAdmin: boolean;
  isCreator: boolean;
  joinedAt: string;
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

class StudyGroupService {
  /**
   * Create a new study group
   */
  async createGroup(data: {
    name: string;
    description: string;
    metadata?: {
      ieltsType?: "academic" | "general";
      targetCountry?: string;
      targetBand?: number;
    };
    settings?: {
      isPrivate?: boolean;
      allowMemberInvites?: boolean;
      requireApproval?: boolean;
    };
  }): Promise<StudyGroup> {
    const headers = await getAuthHeaders();
    const response = await axios.post(`${API_BASE_URL}/groups`, data, {
      headers,
    });
    return response.data.data;
  }

  /**
   * Get user's study groups
   */
  async getMyGroups(): Promise<StudyGroup[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/groups`, { headers });
    return response.data.data;
  }

  /**
   * Get a specific group
   */
  async getGroup(groupId: string): Promise<StudyGroup> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/groups/${groupId}`, {
      headers,
    });
    return response.data.data;
  }

  /**
   * Update group details
   */
  async updateGroup(
    groupId: string,
    updates: {
      name?: string;
      description?: string;
      metadata?: any;
      settings?: any;
    }
  ): Promise<StudyGroup> {
    const headers = await getAuthHeaders();
    const response = await axios.put(
      `${API_BASE_URL}/groups/${groupId}`,
      updates,
      {
        headers,
      }
    );
    return response.data.data;
  }

  /**
   * Delete a group
   */
  async deleteGroup(groupId: string): Promise<{ message: string }> {
    const headers = await getAuthHeaders();
    const response = await axios.delete(
      `${API_BASE_URL}/groups/${groupId}`,
      { headers }
    );
    return response.data;
  }

  /**
   * Invite a user to group
   */
  async inviteMember(
    groupId: string,
    inviteeId: string,
    message?: string
  ): Promise<StudyGroupInvite> {
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}/groups/${groupId}/invite`,
      { inviteeId, message },
      { headers }
    );
    return response.data.data;
  }

  /**
   * Accept group invitation
   */
  async acceptInvite(inviteId: string): Promise<{ message: string }> {
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}/groups/invites/${inviteId}/accept`,
      {},
      { headers }
    );
    return response.data;
  }

  /**
   * Decline group invitation
   */
  async declineInvite(inviteId: string): Promise<{ message: string }> {
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}/groups/invites/${inviteId}/decline`,
      {},
      { headers }
    );
    return response.data;
  }

  /**
   * Get pending group invitations
   */
  async getPendingInvites(): Promise<StudyGroupInvite[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/groups/invites`, {
      headers,
    });
    return response.data.data;
  }

  /**
   * Join a public group
   */
  async joinGroup(groupId: string): Promise<{ message: string }> {
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}/groups/${groupId}/join`,
      {},
      { headers }
    );
    return response.data;
  }

  /**
   * Leave a group
   */
  async leaveGroup(groupId: string): Promise<{ message: string }> {
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}/groups/${groupId}/leave`,
      {},
      { headers }
    );
    return response.data;
  }

  /**
   * Get group members
   */
  async getMembers(groupId: string): Promise<GroupMember[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(
      `${API_BASE_URL}/groups/${groupId}/members`,
      {
        headers,
      }
    );
    return response.data.data;
  }

  /**
   * Remove a member from group
   */
  async removeMember(
    groupId: string,
    memberId: string
  ): Promise<{ message: string }> {
    const headers = await getAuthHeaders();
    const response = await axios.delete(
      `${API_BASE_URL}/groups/${groupId}/members/${memberId}`,
      { headers }
    );
    return response.data;
  }

  /**
   * Promote member to admin
   */
  async promoteToAdmin(
    groupId: string,
    memberId: string
  ): Promise<{ message: string }> {
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}/groups/${groupId}/admins/${memberId}`,
      {},
      { headers }
    );
    return response.data;
  }

  /**
   * Remove admin role
   */
  async removeAdmin(
    groupId: string,
    adminId: string
  ): Promise<{ message: string }> {
    const headers = await getAuthHeaders();
    const response = await axios.delete(
      `${API_BASE_URL}/groups/${groupId}/admins/${adminId}`,
      { headers }
    );
    return response.data;
  }

  /**
   * Search public groups
   */
  async searchGroups(filters: {
    query?: string;
    ieltsType?: "academic" | "general";
    targetCountry?: string;
  }): Promise<StudyGroup[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/groups/search`, {
      headers,
      params: filters,
    });
    return response.data.data;
  }

  /**
   * Get suggested groups
   */
  async getSuggestedGroups(limit: number = 10): Promise<StudyGroup[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/groups/suggestions`, {
      headers,
      params: { limit },
    });
    return response.data.data;
  }
}

export default new StudyGroupService();
