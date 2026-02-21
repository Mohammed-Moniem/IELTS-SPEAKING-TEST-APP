import { useCallback, useState } from "react";
import groupService, {
  GroupMember,
  StudyGroup,
  StudyGroupInvite,
} from "../services/api/groupService";

export const useStudyGroups = () => {
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [invites, setInvites] = useState<StudyGroupInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await groupService.getMyGroups();
      setGroups(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load groups");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvites = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await groupService.getPendingInvites();
      setInvites(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load invites");
    } finally {
      setLoading(false);
    }
  }, []);

  const createGroup = useCallback(
    async (data: {
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
    }) => {
      try {
        setLoading(true);
        setError(null);
        const newGroup = await groupService.createGroup(data);
        await loadGroups();
        return newGroup;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to create group");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [loadGroups]
  );

  const getGroup = useCallback(
    async (groupId: string): Promise<StudyGroup | null> => {
      try {
        setLoading(true);
        setError(null);
        const group = await groupService.getGroup(groupId);
        return group;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load group");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateGroup = useCallback(
    async (groupId: string, updates: any) => {
      try {
        setLoading(true);
        setError(null);
        await groupService.updateGroup(groupId, updates);
        await loadGroups();
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to update group");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadGroups]
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      try {
        setLoading(true);
        setError(null);
        await groupService.deleteGroup(groupId);
        await loadGroups();
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to delete group");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadGroups]
  );

  const inviteMember = useCallback(
    async (groupId: string, inviteeId: string, message?: string) => {
      try {
        setLoading(true);
        setError(null);
        await groupService.inviteMember(groupId, inviteeId, message);
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to invite member");
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const acceptInvite = useCallback(
    async (inviteId: string) => {
      try {
        setLoading(true);
        setError(null);
        await groupService.acceptInvite(inviteId);
        await Promise.all([loadGroups(), loadInvites()]);
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to accept invite");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadGroups, loadInvites]
  );

  const declineInvite = useCallback(
    async (inviteId: string) => {
      try {
        setLoading(true);
        setError(null);
        await groupService.declineInvite(inviteId);
        await loadInvites();
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to decline invite");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadInvites]
  );

  const joinGroup = useCallback(
    async (groupId: string) => {
      try {
        setLoading(true);
        setError(null);
        await groupService.joinGroup(groupId);
        await loadGroups();
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to join group");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadGroups]
  );

  const leaveGroup = useCallback(
    async (groupId: string) => {
      try {
        setLoading(true);
        setError(null);
        await groupService.leaveGroup(groupId);
        await loadGroups();
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to leave group");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadGroups]
  );

  const getMembers = useCallback(
    async (groupId: string): Promise<GroupMember[]> => {
      try {
        setLoading(true);
        setError(null);
        const members = await groupService.getMembers(groupId);
        return members;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load members");
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const removeMember = useCallback(
    async (groupId: string, memberId: string) => {
      try {
        setLoading(true);
        setError(null);
        await groupService.removeMember(groupId, memberId);
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to remove member");
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const addMember = useCallback(
    async (groupId: string, memberId: string) => {
      try {
        setLoading(true);
        setError(null);
        const updated = await groupService.addMember(groupId, memberId);
        return updated;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to add member");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const promoteToAdmin = useCallback(
    async (groupId: string, memberId: string) => {
      try {
        setLoading(true);
        setError(null);
        await groupService.promoteToAdmin(groupId, memberId);
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to promote member");
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const removeAdmin = useCallback(async (groupId: string, adminId: string) => {
    try {
      setLoading(true);
      setError(null);
      await groupService.removeAdmin(groupId, adminId);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to remove admin");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchGroups = useCallback(
    async (filters: {
      query?: string;
      ieltsType?: "academic" | "general";
      targetCountry?: string;
    }): Promise<StudyGroup[]> => {
      try {
        setLoading(true);
        setError(null);
        const results = await groupService.searchGroups(filters);
        return results;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to search groups");
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getSuggestedGroups = useCallback(async (): Promise<StudyGroup[]> => {
    try {
      setLoading(true);
      setError(null);
      const suggestions = await groupService.getSuggestedGroups(10);
      return suggestions;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to get suggestions");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    groups,
    invites,
    loading,
    error,
    loadGroups,
    loadInvites,
    createGroup,
    getGroup,
    updateGroup,
    deleteGroup,
    inviteMember,
    acceptInvite,
    declineInvite,
    joinGroup,
    leaveGroup,
    getMembers,
    removeMember,
    addMember,
    promoteToAdmin,
    removeAdmin,
    searchGroups,
    getSuggestedGroups,
  };
};
