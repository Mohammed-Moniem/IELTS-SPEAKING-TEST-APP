import { apiClient } from "../../api/client";

export interface StudyGroup {
  _id: string;
  name: string;
  description: string;
  creatorId: string;
  adminIds: string[];
  memberIds: string[];
  memberCount: number;
  maxMembers: number;
  isCreator: boolean;
  isAdmin: boolean;
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
  id: string;
  userId: string;
  displayName?: string;
  email?: string;
  username?: string;
  avatar?: string;
  bio?: string;
  lastActive?: string;
  isAdmin: boolean;
  isCreator: boolean;
}

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
    memberIds?: string[];
  }): Promise<StudyGroup> {
    const response = await apiClient.post(`/groups`, data);
    return response.data.data;
  }

  /**
   * Get user's study groups
   */
  async getMyGroups(): Promise<StudyGroup[]> {
    const response = await apiClient.get(`/groups`);
    return response.data.data;
  }

  /**
   * Get a specific group
   */
  async getGroup(groupId: string): Promise<StudyGroup> {
    const response = await apiClient.get(`/groups/${groupId}`);
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
    const response = await apiClient.put(`/groups/${groupId}`, updates);
    return response.data.data;
  }

  /**
   * Delete a group
   */
  async deleteGroup(groupId: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/groups/${groupId}`);
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
    const response = await apiClient.post(`/groups/${groupId}/invite`, {
      inviteeId,
      message,
    });
    return response.data.data;
  }

  /**
   * Accept group invitation
   */
  async acceptInvite(inviteId: string): Promise<{ message: string }> {
    const response = await apiClient.post(
      `/groups/invites/${inviteId}/accept`,
      {}
    );
    return response.data;
  }

  /**
   * Decline group invitation
   */
  async declineInvite(inviteId: string): Promise<{ message: string }> {
    const response = await apiClient.post(
      `/groups/invites/${inviteId}/decline`,
      {}
    );
    return response.data;
  }

  /**
   * Get pending group invitations
   */
  async getPendingInvites(): Promise<StudyGroupInvite[]> {
    const response = await apiClient.get(`/groups/invites`);
    return response.data.data;
  }

  /**
   * Join a public group
   */
  async joinGroup(groupId: string): Promise<StudyGroup> {
    const response = await apiClient.post(`/groups/${groupId}/join`, {});
    return response.data.data;
  }

  /**
   * Leave a group
   */
  async leaveGroup(groupId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/groups/${groupId}/leave`, {});
    return response.data;
  }

  /**
   * Get group members
   */
  async getMembers(groupId: string): Promise<GroupMember[]> {
    const response = await apiClient.get(`/groups/${groupId}/members`);
    return response.data.data;
  }

  /**
   * Remove a member from group
   */
  async removeMember(
    groupId: string,
    memberId: string
  ): Promise<{ message: string }> {
    const response = await apiClient.delete(
      `/groups/${groupId}/members/${memberId}`
    );
    return response.data;
  }

  async addMember(
    groupId: string,
    memberId: string
  ): Promise<StudyGroup> {
    const response = await apiClient.post(`/groups/${groupId}/members`, {
      memberId,
    });
    return response.data.data;
  }

  /**
   * Promote member to admin
   */
  async promoteToAdmin(
    groupId: string,
    memberId: string
  ): Promise<{ message: string }> {
    const response = await apiClient.post(
      `/groups/${groupId}/admins/${memberId}`,
      {}
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
    const response = await apiClient.delete(
      `/groups/${groupId}/admins/${adminId}`
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
    const response = await apiClient.get(`/groups/search`, {
      params: filters,
    });
    return response.data.data;
  }

  /**
   * Get suggested groups
   */
  async getSuggestedGroups(limit: number = 10): Promise<StudyGroup[]> {
    const response = await apiClient.get(`/groups/suggestions`, {
      params: { limit },
    });
    return response.data.data;
  }
}

export default new StudyGroupService();
